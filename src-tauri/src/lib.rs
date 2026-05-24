use base64::Engine;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use sysinfo::System;
use tauri::webview::Color;
use tauri::{Emitter, Manager};

#[cfg(target_os = "windows")]
mod thumbbar;

mod local_music;

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
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateDownloadProgress {
    download_id: String,
    downloaded: u64,
    total: Option<u64>,
    percent: Option<f64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateDownloadResult {
    path: String,
    file_name: String,
}

fn sanitize_download_file_name(file_name: &str) -> String {
    let sanitized: String = file_name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0' => '_',
            _ => ch,
        })
        .collect();

    let trimmed = sanitized.trim().trim_matches('.');
    if trimmed.is_empty() {
        "CyreneMusicNext-update".to_string()
    } else {
        trimmed.to_string()
    }
}

fn resolve_update_download_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        app.path()
            .app_cache_dir()
            .map(|path| path.join("updates"))
            .map_err(|e| format!("Resolve app cache dir failed: {}", e))
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        app.path()
            .download_dir()
            .map_err(|e| format!("Resolve downloads dir failed: {}", e))
    }
}

#[tauri::command]
async fn download_update(
    app: tauri::AppHandle,
    url: String,
    file_name: String,
    download_id: String,
) -> Result<UpdateDownloadResult, String> {
    let file_name = sanitize_download_file_name(&file_name);
    let download_dir = resolve_update_download_dir(&app)?;
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Create download dir failed: {}", e))?;

    let file_path = download_dir.join(&file_name);
    let partial_path = download_dir.join(format!("{}.download", file_name));

    let client = reqwest::Client::builder()
        .user_agent("CyreneMusicNext updater")
        .build()
        .map_err(|e| format!("Create HTTP client failed: {}", e))?;

    let mut response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download request failed with status {}", response.status()));
    }

    let total = response.content_length();
    let mut file = File::create(&partial_path)
        .map_err(|e| format!("Create download file failed: {}", e))?;
    let mut downloaded = 0_u64;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Read download chunk failed: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Write download file failed: {}", e))?;
        downloaded += chunk.len() as u64;

        let percent = total
            .filter(|value| *value > 0)
            .map(|value| downloaded as f64 / value as f64 * 100.0);
        let _ = app.emit(
            "update:download-progress",
            UpdateDownloadProgress {
                download_id: download_id.clone(),
                downloaded,
                total,
                percent,
            },
        );
    }

    file.flush()
        .map_err(|e| format!("Flush download file failed: {}", e))?;
    drop(file);

    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Remove existing update file failed: {}", e))?;
    }
    std::fs::rename(&partial_path, &file_path)
        .map_err(|e| format!("Finalize download file failed: {}", e))?;

    Ok(UpdateDownloadResult {
        path: file_path.to_string_lossy().to_string(),
        file_name,
    })
}

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
    .background_color(Color(0, 0, 0, 0))
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
fn update_window_material(window: tauri::Window, material: String, is_dark: bool) -> Result<(), String> {
    match material.as_str() {
        "mica" => {
            let _ = window_vibrancy::apply_mica(&window, Some(is_dark));
        }
        "acrylic" => {
            // 亚克力材质使用半透明背景色
            let color = if is_dark {
                (18, 18, 18, 180) // 深色模式下的半透明暗色
            } else {
                (255, 255, 255, 180) // 浅色模式下的半透明亮色
            };
            let _ = window_vibrancy::apply_acrylic(&window, Some(color));
        }
        _ => {
            // "opaque" - 不做任何操作，前端用 CSS 覆盖
        }
    }
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn set_window_material(window: tauri::Window, material: String) -> Result<(), String> {
    // 对于 opaque 不需要设置任何材质效果
    // 对于 mica / acrylic，先用 None/默认参数设置一次
    match material.as_str() {
        "mica" => {
            let _ = window_vibrancy::apply_mica(&window, None);
        }
        "acrylic" => {
            let _ = window_vibrancy::apply_acrylic(&window, Some((18, 18, 18, 180)));
        }
        _ => {
            // "opaque" - 前端处理
        }
    }
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

    let response = request
        .send()
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
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read body: {}", e))?;
    let body_json: serde_json::Value =
        serde_json::from_str(&body_text).unwrap_or(serde_json::Value::String(body_text));

    Ok(serde_json::json!({
        "statusCode": status,
        "headers": headers,
        "body": body_json
    }))
}

#[cfg(target_os = "android")]
#[derive(serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidMediaNotificationPayload {
    title: String,
    artist: String,
    album: Option<String>,
    artwork_url: Option<String>,
    is_playing: bool,
    duration_ms: u64,
    position_ms: u64,
}

#[cfg(target_os = "android")]
fn with_android_activity<F>(mut callback: F) -> Result<(), String>
where
    F: FnMut(&mut jni::JNIEnv, jni::objects::JObject) -> Result<(), String>,
{
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }
        .map_err(|e| format!("Get JVM fail: {}", e))?;
    let mut env_guard = vm
        .attach_current_thread()
        .map_err(|e| format!("Attach thread fail: {}", e))?;
    let env = &mut *env_guard;
    let activity = unsafe { jni::objects::JObject::from_raw(ctx.context() as *mut _) };
    callback(env, activity)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn android_media_notification_update(
    payload: AndroidMediaNotificationPayload,
) -> Result<(), String> {
    let payload_json = serde_json::to_string(&payload)
        .map_err(|e| format!("Serialize notification payload fail: {}", e))?;

    with_android_activity(|env, activity| {
        let payload_arg = env
            .new_string(&payload_json)
            .map_err(|e| format!("Create payload string fail: {}", e))?;
        let payload_obj = jni::objects::JObject::from(payload_arg);

        env.call_method(
            &activity,
            "updateMediaNotification",
            "(Ljava/lang/String;)V",
            &[jni::objects::JValue::Object(&payload_obj)],
        )
        .map_err(|e| format!("Call updateMediaNotification fail: {:?}", e))?;

        Ok(())
    })
}

#[cfg(target_os = "android")]
#[tauri::command]
fn android_media_notification_hide() -> Result<(), String> {
    with_android_activity(|env, activity| {
        env.call_method(&activity, "hideMediaNotification", "()V", &[])
            .map_err(|e| format!("Call hideMediaNotification fail: {:?}", e))?;

        Ok(())
    })
}

#[cfg(target_os = "android")]
#[tauri::command]
fn android_install_apk(file_path: String) -> Result<(), String> {
    with_android_activity(|env, activity| {
        let path_arg = env
            .new_string(&file_path)
            .map_err(|e| format!("Create path string fail: {}", e))?;
        let path_obj = jni::objects::JObject::from(path_arg);

        env.call_method(
            &activity,
            "installApk",
            "(Ljava/lang/String;)V",
            &[jni::objects::JValue::Object(&path_obj)],
        )
        .map_err(|e| format!("Call installApk fail: {:?}", e))?;

        Ok(())
    })
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn android_install_apk(_file_path: String) -> Result<(), String> {
    Err("Not supported on this platform".to_string())
}

#[derive(serde::Serialize)]
struct SystemInfo {
    name: String,
    os_version: String,
    kernel_version: String,
    total_memory: u64,
    is_mica_supported: bool,
    is_acrylic_supported: bool,
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
        } else if let Some(build) = os_version
            .split('.')
            .nth(2)
            .and_then(|s| s.parse::<u32>().ok())
        {
            build >= 22000
        } else if let Some(start) = os_version.find('(') {
            if let Some(end) = os_version.find(')') {
                let build_str = &os_version[start + 1..end];
                build_str
                    .parse::<u32>()
                    .map(|b| b >= 22000)
                    .unwrap_or(false)
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    // Acrylic 需要 Windows 10 v1809+ (build 17763+)
    let is_acrylic_supported = if cfg!(target_os = "windows") {
        if is_mica_supported {
            true // Windows 11 也支持 Acrylic
        } else if let Some(build) = os_version
            .split('.')
            .nth(2)
            .and_then(|s| s.parse::<u32>().ok())
        {
            build >= 17763
        } else if let Some(start) = os_version.find('(') {
            if let Some(end) = os_version.find(')') {
                let build_str = &os_version[start + 1..end];
                build_str
                    .parse::<u32>()
                    .map(|b| b >= 17763)
                    .unwrap_or(false)
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
        is_acrylic_supported,
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
fn set_status_bar_style(_is_dark_text: bool) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use jni::objects::JValue;

        with_android_activity(|env, activity| {
            env.call_method(
                &activity,
                "setStatusBarDarkText",
                "(Z)V",
                &[JValue::Bool(_is_dark_text as jni::sys::jboolean)],
            )
            .map_err(|e| format!("call_method fail: {:?}", e))?;

            Ok(())
        })?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn update_thumbbar_playing_state(is_playing: bool) {
    thumbbar::update_thumbbar_state(is_playing);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler({
            #[cfg(desktop)]
            {
                #[cfg(target_os = "windows")]
                {
                    tauri::generate_handler![
                        greet,
                        fetch_image,
                        download_update,
                        android_install_apk,
                        open_desktop_lyric,
                        close_desktop_lyric,
                        update_window_material,
                        set_window_material,
                        lx_http_request,
                        get_system_info,
                        get_process_info,
                        set_status_bar_style,
                        update_thumbbar_playing_state,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music
                    ]
                }
                #[cfg(not(target_os = "windows"))]
                {
                    tauri::generate_handler![
                        greet,
                        fetch_image,
                        download_update,
                        android_install_apk,
                        open_desktop_lyric,
                        close_desktop_lyric,
                        update_window_material,
                        set_window_material,
                        lx_http_request,
                        get_system_info,
                        get_process_info,
                        set_status_bar_style,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music
                    ]
                }
            }
            #[cfg(mobile)]
            {
                #[cfg(target_os = "android")]
                {
                    tauri::generate_handler![
                        greet,
                        fetch_image,
                        download_update,
                        android_install_apk,
                        lx_http_request,
                        get_system_info,
                        get_process_info,
                        set_status_bar_style,
                        android_media_notification_update,
                        android_media_notification_hide,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music
                    ]
                }
                #[cfg(not(target_os = "android"))]
                {
                    tauri::generate_handler![
                        greet,
                        fetch_image,
                        download_update,
                        android_install_apk,
                        lx_http_request,
                        get_system_info,
                        get_process_info,
                        set_status_bar_style,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music
                    ]
                }
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                // 不再固定 apply_mica，由前端通过 set_window_material 命令动态设置
                let _ = app.get_webview_window("main");

                // Windows: 初始化任务栏缩略图工具栏按钮
                #[cfg(target_os = "windows")]
                {
                    if let Some(main_window) = app.get_webview_window("main") {
                        use tauri::Emitter;
                        let app_handle = app.handle().clone();
                        if let Ok(hwnd) = main_window.hwnd() {
                            thumbbar::init_thumbbar(
                                hwnd.0 as isize,
                                Box::new(move |cmd: &str| {
                                    let _ = app_handle.emit("player:command", cmd.to_string());
                                }),
                            );
                        }
                    }
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
