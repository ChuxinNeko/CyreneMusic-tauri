use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// 存储代理服务器端口，通过 Tauri State 共享给前端
pub struct AudioProxyPort(pub u16);

/// 启动音频代理服务器（独立线程 + 独立 tokio 运行时），返回监听端口。
/// 同步函数，可在 Tauri setup 中直接调用。
pub fn start() -> u16 {
    // 同步绑定以立即获取端口号
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0")
        .expect("[AudioProxy] Failed to bind TCP listener");
    let port = std_listener.local_addr().unwrap().port();
    std_listener.set_nonblocking(true).unwrap();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_io()
            .build()
            .expect("[AudioProxy] Failed to create tokio runtime");

        rt.block_on(async move {
            let listener = TcpListener::from_std(std_listener)
                .expect("[AudioProxy] Failed to convert TcpListener");
            let client = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .redirect(reqwest::redirect::Policy::limited(10))
                .build()
                .expect("[AudioProxy] Failed to create HTTP client");

            println!("[AudioProxy] Listening on 127.0.0.1:{}", port);

            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        let client = client.clone();
                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(stream, &client).await {
                                eprintln!("[AudioProxy] Connection error: {}", e);
                            }
                        });
                    }
                    Err(e) => eprintln!("[AudioProxy] Accept error: {}", e),
                }
            }
        });
    });

    println!("[AudioProxy] Started on port {}", port);
    port
}

async fn handle_connection(
    mut stream: tokio::net::TcpStream,
    client: &reqwest::Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // ── 读取 HTTP 请求头 ──
    let mut buf = vec![0u8; 8192];
    let mut total = 0;

    loop {
        let n = stream.read(&mut buf[total..]).await?;
        if n == 0 {
            return Ok(());
        }
        total += n;
        if let Ok(s) = std::str::from_utf8(&buf[..total]) {
            if s.contains("\r\n\r\n") {
                break;
            }
        }
        if total >= buf.len() {
            write_error(&mut stream, 431, "Header Too Large").await?;
            return Ok(());
        }
    }

    let request_str = std::str::from_utf8(&buf[..total])?;
    let first_line = request_str.lines().next().unwrap_or("");

    // ── CORS 预检 ──
    if first_line.starts_with("OPTIONS") {
        let resp = "HTTP/1.1 204 No Content\r\n\
            Access-Control-Allow-Origin: *\r\n\
            Access-Control-Allow-Methods: GET, OPTIONS\r\n\
            Access-Control-Allow-Headers: Range\r\n\
            Access-Control-Max-Age: 86400\r\n\
            Connection: close\r\n\r\n";
        stream.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    // ── 解析请求行 ──
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 || parts[0] != "GET" {
        write_error(&mut stream, 405, "Method Not Allowed").await?;
        return Ok(());
    }

    let target_url = match extract_url_param(parts[1]) {
        Some(u) => u,
        None => {
            write_error(&mut stream, 400, "Missing url param").await?;
            return Ok(());
        }
    };

    // ── 提取 Range 头（音频 seek 必需） ──
    let range_header = request_str
        .lines()
        .find(|l| l.to_ascii_lowercase().starts_with("range:"))
        .and_then(|l| l.splitn(2, ':').nth(1))
        .map(|v| v.trim().to_string());

    // ── 向上游发起请求（不带 Referer/Origin，绕过 CDN 防盗链） ──
    let mut req = client.get(&target_url);
    if let Some(ref range) = range_header {
        req = req.header("Range", range.as_str());
    }

    let mut upstream = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            write_error(&mut stream, 502, &format!("Upstream error: {}", e)).await?;
            return Ok(());
        }
    };

    // ── 构造响应头 ──
    let status = upstream.status();
    let ct = upstream
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let cl = upstream
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let cr = upstream
        .headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let mut resp_header = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges\r\n\
         Accept-Ranges: bytes\r\n\
         Connection: close\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("OK"),
        ct
    );
    if let Some(ref v) = cl {
        resp_header.push_str(&format!("Content-Length: {}\r\n", v));
    }
    if let Some(ref v) = cr {
        resp_header.push_str(&format!("Content-Range: {}\r\n", v));
    }
    resp_header.push_str("\r\n");

    stream.write_all(resp_header.as_bytes()).await?;

    // ── 流式转发响应体 ──
    while let Some(chunk) = upstream.chunk().await? {
        if stream.write_all(&chunk).await.is_err() {
            break; // 客户端断开连接
        }
    }

    Ok(())
}

// ── 工具函数 ──

/// 从 /proxy?url=<encoded> 中提取并解码目标 URL
fn extract_url_param(path: &str) -> Option<String> {
    let query = path.split('?').nth(1)?;
    for param in query.split('&') {
        if let Some(value) = param.strip_prefix("url=") {
            return Some(percent_decode(value));
        }
    }
    None
}

fn percent_decode(input: &str) -> String {
    let mut out = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(if bytes[i] == b'+' { b' ' } else { bytes[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

async fn write_error(
    stream: &mut tokio::net::TcpStream,
    code: u16,
    msg: &str,
) -> Result<(), std::io::Error> {
    let body = msg.as_bytes();
    let resp = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: text/plain\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Connection: close\r\n\r\n",
        code, msg, body.len()
    );
    stream.write_all(resp.as_bytes()).await?;
    stream.write_all(body).await
}
