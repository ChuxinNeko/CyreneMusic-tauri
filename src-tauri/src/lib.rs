use tauri::Manager;
use base64::Engine;
use std::collections::HashMap;
use serde::Deserialize;
use sysinfo::System;
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref SYS: Mutex<System> = Mutex::new(System::new_all());
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 通过 Rust 原生 HTTP 下载图片，绕过 WebView CORS 限制
/// 返回 data URL (data:image/xxx;base64,...)
#[tauri::command]
async fn fetch_image(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, b64))
}

#[cfg(desktop)]
#[tauri::command]
async fn open_desktop_lyric(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("desktop-lyric") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "desktop-lyric",
        tauri::WebviewUrl::App("desktop-lyric".into()),
    )
    .title("Desktop Lyric")
    .resizable(false)
    .focused(false)
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .inner_size(800.0, 100.0)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn close_desktop_lyric(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("desktop-lyric") {
        let _ = window.close();
    }
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn update_vibrancy(window: tauri::Window, is_dark: bool) -> Result<(), String> {
    let _ = window_vibrancy::apply_mica(&window, Some(is_dark));
    Ok(())
}

#[derive(Deserialize)]
struct HttpRequestOptions {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<serde_json::Value>,
}

#[tauri::command]
async fn lx_http_request(options: HttpRequestOptions) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let method = match options.method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        _ => reqwest::Method::GET,
    };

    let mut request = client.request(method, &options.url);

    for (key, value) in options.headers {
        request = request.header(key, value);
    }

    if let Some(body) = options.body {
        if body.is_object() || body.is_array() {
            request = request.json(&body);
        } else if let Some(s) = body.as_str() {
            request = request.body(s.to_string());
        }
    }

    let response = request.send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    
    // 获取响应头
    let mut headers = HashMap::new();
    for (name, value) in response.headers().iter() {
        if let Ok(val_str) = value.to_str() {
            headers.insert(name.to_string(), val_str.to_string());
        }
    }

    // 尝试解析 JSON，如果失败则返回文本
    let body_text = response.text().await.map_err(|e| format!("Failed to read body: {}", e))?;
    let body_json: serde_json::Value = serde_json::from_str(&body_text).unwrap_or(serde_json::Value::String(body_text));

    Ok(serde_json::json!({
        "statusCode": status,
        "headers": headers,
        "body": body_json
    }))
}

#[derive(serde::Serialize)]
struct SystemInfo {
    name: String,
    os_version: String,
    kernel_version: String,
    total_memory: u64,
    is_mica_supported: bool,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut sys = SYS.lock().unwrap();
    sys.refresh_memory();
    
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_owned());
    let is_mica_supported = if cfg!(target_os = "windows") {
        // Windows 11 is version 10.0, build 22000+
        // os_version can be "10.0.22000" or "11 (26200)" depending on sysinfo version/OS
        if os_version.contains("11") {
            true
        } else if let Some(build) = os_version.split('.').nth(2).and_then(|s| s.parse::<u32>().ok()) {
            build >= 22000
        } else if let Some(start) = os_version.find('(') {
            if let Some(end) = os_version.find(')') {
                let build_str = &os_version[start + 1..end];
                build_str.parse::<u32>().map(|b| b >= 22000).unwrap_or(false)
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };
    
    SystemInfo {
        name: System::name().unwrap_or_else(|| "Unknown".to_owned()),
        os_version,
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".to_owned()),
        total_memory: sys.total_memory(), // IN BYTES
        is_mica_supported,
    }
}

#[derive(serde::Serialize)]
struct ProcessInfo {
    memory: u64,
    cpu_usage: f32,
}

#[tauri::command]
fn get_process_info() -> ProcessInfo {
    let mut sys = SYS.lock().unwrap();
    sys.refresh_processes();
    let pid = sysinfo::get_current_pid().unwrap();
    
    if let Some(process) = sys.process(pid) {
        ProcessInfo {
            memory: process.memory(), // IN BYTES
            cpu_usage: process.cpu_usage(),
        }
    } else {
        ProcessInfo {
            memory: 0,
            cpu_usage: 0.0,
        }
    }
}

#[tauri::command]
fn set_status_bar_style(is_dark_text: bool) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use jni::objects::JValue;
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }
            .map_err(|e| format!("Get JVM fail: {}", e))?;
        let mut env = vm.attach_current_thread().map_err(|e| format!("Attach thread fail: {}", e))?;
        
        let activity = unsafe { jni::objects::JObject::from_raw(ctx.context() as *mut _) };
        
        env.call_method(
            &activity,
            "setStatusBarDarkText",
            "(Z)V",
            &[JValue::Bool(is_dark_text as jni::sys::jboolean)],
        ).map_err(|e| format!("call_method fail: {:?}", e))?;
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler({
            #[cfg(desktop)]
            {
                tauri::generate_handler![greet, fetch_image, open_desktop_lyric, close_desktop_lyric, update_vibrancy, lx_http_request, get_system_info, get_process_info, set_status_bar_style]
            }
            #[cfg(mobile)]
            {
                tauri::generate_handler![greet, fetch_image, lx_http_request, get_system_info, get_process_info, set_status_bar_style]
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window_vibrancy::apply_mica(&window, None);
                }

                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

                let _ = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Cyrene Music")
                    .on_tray_icon_event(move |tray, event| {
                        match event {
                            TrayIconEvent::Click {
                                button: MouseButton::Left | MouseButton::Right,
                                button_state: MouseButtonState::Up,
                                position,
                                ..
                            } => {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("tray") {
                                    // Get current inner size to calculate position dynamically
                                    let size = window.inner_size().unwrap_or(tauri::PhysicalSize {
                                        width: 200,
                                        height: 130,
                                    });
                                    let window_height = size.height as f64;

                                    let click_x = position.x;
                                    let click_y = position.y;

                                    let x = click_x;
                                    // Shift up by window height + small margin
                                    let y = click_y - window_height - 10.0;

                                    let _ = window.set_position(tauri::Position::Physical(
                                        tauri::PhysicalPosition {
                                            x: x as i32,
                                            y: y as i32,
                                        },
                                    ));
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                } else {
                                    let _ = tauri::WebviewWindowBuilder::new(
                                        app,
                                        "tray",
                                        tauri::WebviewUrl::App("tray".into()),
                                    )
                                    .title("Tray Menu")
                                    .resizable(false)
                                    .focused(true)
                                    .decorations(false)
                                    .always_on_top(true)
                                    .visible(false)
                                    .skip_taskbar(true)
                                    .inner_size(200.0, 120.0)
                                    .build()
                                    .unwrap();
                                }
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
