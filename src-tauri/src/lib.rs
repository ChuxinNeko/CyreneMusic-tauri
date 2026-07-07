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
mod audio_proxy;
mod taskbar_player;
mod wallpaper_engine;

lazy_static::lazy_static! {
    static ref SYS: Mutex<System> = Mutex::new(System::new_all());
    static ref TABLE_PLAYER_PINNED: Mutex<bool> = Mutex::new(false);
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
    #[cfg(target_os = "ios")]
    {
        // iOS 上将包放在 Documents 目录，配合 iTunes 文件共享即可在自带“文件”App 中看到
        app.path()
            .document_dir()
            .map_err(|e| format!("Resolve documents dir failed: {}", e))
    }

    #[cfg(not(target_os = "ios"))]
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
    .transparent(true)
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
async fn open_recommend_popup(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("song-recommend") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 获取主窗口所在显示器的工作区来定位窗口到右下角
    let popup_width = 360.0_f64;
    let popup_height = 460.0_f64;
    let margin = 16.0_f64;

    let (x, y) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(monitor) = main_win.current_monitor() {
            if let Some(monitor) = monitor {
                let size = monitor.size();
                let pos = monitor.position();
                let scale = main_win.scale_factor().unwrap_or(1.0);
                let work_w = size.width as f64 / scale;
                let work_h = size.height as f64 / scale;
                let origin_x = pos.x as f64 / scale;
                let origin_y = pos.y as f64 / scale;
                (
                    origin_x + work_w - popup_width - margin,
                    origin_y + work_h - popup_height - margin - 48.0, // 48px 给任务栏留空
                )
            } else {
                (1200.0, 500.0)
            }
        } else {
            (1200.0, 500.0)
        }
    } else {
        (1200.0, 500.0)
    };

    tauri::WebviewWindowBuilder::new(
        &app,
        "song-recommend",
        tauri::WebviewUrl::App("song-recommend".into()),
    )
    .title("Song Recommend")
    .resizable(false)
    .focused(false)
    .decorations(false)
    .always_on_top(true)
    .background_color(Color(0, 0, 0, 0))
    .skip_taskbar(true)
    .shadow(true)
    .inner_size(popup_width, popup_height)
    .position(x, y)
    .build()
    .map_err(|e| format!("Failed to create recommend popup: {}", e))?;

    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn close_recommend_popup(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("song-recommend") {
        let _ = window.close();
    }
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn open_table_player(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("table-player") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let popup_width = 320.0_f64;
    let margin = 0.0_f64;

    let (x, y, height) = if let Some(main_win) = app.get_webview_window("main") {
        let pos = main_win.inner_position().unwrap_or_default();
        let size = main_win.inner_size().unwrap_or_default();
        let scale = main_win.scale_factor().unwrap_or(1.0);
        
        let origin_x = pos.x as f64 / scale;
        let origin_y = pos.y as f64 / scale;
        let work_w = size.width as f64 / scale;
        let work_h = size.height as f64 / scale;

        (
            origin_x + work_w + margin,
            origin_y,
            work_h
        )
    } else {
        (1200.0, 100.0, 800.0)
    };

    tauri::WebviewWindowBuilder::new(
        &app,
        "table-player",
        tauri::WebviewUrl::App("tableplayer".into()),
    )
    .title("Table Player")
    .resizable(true)
    .focused(false)
    .decorations(false)
    .transparent(true)
    .background_color(Color(0, 0, 0, 0))
    .skip_taskbar(true)
    .shadow(true)
    .inner_size(popup_width, height)
    .position(x, y)
    .build()
    .map_err(|e| format!("Failed to create table player: {}", e))?;

    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn close_table_player(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("table-player") {
        let _ = window.close();
    }
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn toggle_table_player_pin(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("table-player")
        .ok_or("table-player window not found")?;

    let mut pinned = TABLE_PLAYER_PINNED.lock().map_err(|e| e.to_string())?;
    *pinned = !*pinned;
    let new_state = *pinned;

    let _ = window.set_always_on_top(new_state);
    // 置顶时将窗口提升到最前
    if new_state {
        let _ = window.set_focus();
    }

    Ok(new_state)
}

#[cfg(desktop)]
#[tauri::command]
fn get_table_player_pin_state() -> Result<bool, String> {
    let pinned = TABLE_PLAYER_PINNED.lock().map_err(|e| e.to_string())?;
    Ok(*pinned)
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
#[derive(serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidLyricNotificationPayload {
    title: String,
    lyric: String,
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
fn android_lyric_notification_update(
    payload: AndroidLyricNotificationPayload,
) -> Result<(), String> {
    let payload_json = serde_json::to_string(&payload)
        .map_err(|e| format!("Serialize lyric notification payload fail: {}", e))?;

    with_android_activity(|env, activity| {
        let payload_arg = env
            .new_string(&payload_json)
            .map_err(|e| format!("Create payload string fail: {}", e))?;
        let payload_obj = jni::objects::JObject::from(payload_arg);

        env.call_method(
            &activity,
            "updateLyricNotification",
            "(Ljava/lang/String;)V",
            &[jni::objects::JValue::Object(&payload_obj)],
        )
        .map_err(|e| format!("Call updateLyricNotification fail: {:?}", e))?;

        Ok(())
    })
}

#[cfg(target_os = "android")]
#[tauri::command]
fn android_lyric_notification_hide() -> Result<(), String> {
    with_android_activity(|env, activity| {
        env.call_method(&activity, "hideLyricNotification", "()V", &[])
            .map_err(|e| format!("Call hideLyricNotification fail: {:?}", e))?;

        Ok(())
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AndroidInstallResult {
    success: bool,
    error_code: String,
    message: String,
    needs_permission: bool,
}

#[cfg(target_os = "android")]
#[tauri::command]
fn android_install_apk(file_path: String) -> Result<AndroidInstallResult, String> {
    use jni::objects::JValue;

    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm() as *mut _) }
        .map_err(|e| format!("Get JVM fail: {}", e))?;
    let mut env_guard = vm
        .attach_current_thread()
        .map_err(|e| format!("Attach thread fail: {}", e))?;
    let env = &mut *env_guard;
    let activity = unsafe { jni::objects::JObject::from_raw(ctx.context() as *mut _) };

    let path_arg = env
        .new_string(&file_path)
        .map_err(|e| format!("Create path string fail: {}", e))?;
    let path_obj = jni::objects::JObject::from(path_arg);

    let result = env
        .call_method(
            &activity,
            "installApkSync",
            "(Ljava/lang/String;)Ljava/lang/String;",
            &[JValue::Object(&path_obj)],
        )
        .map_err(|e| format!("Call installApkSync fail: {:?}", e))?;

    let jstr: jni::objects::JString = result
        .l()
        .map_err(|e| format!("Extract result object fail: {:?}", e))?
        .into();
    let result_str: String = env
        .get_string(&jstr)
        .map_err(|e| format!("Get result string fail: {:?}", e))?
        .into();

    let parsed: serde_json::Value = serde_json::from_str(&result_str)
        .map_err(|e| format!("Parse install result JSON fail: {}", e))?;

    Ok(AndroidInstallResult {
        success: parsed.get("success").and_then(|v| v.as_bool()).unwrap_or(false),
        error_code: parsed
            .get("errorCode")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        message: parsed
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        needs_permission: parsed
            .get("needsPermission")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    })
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn android_install_apk(_file_path: String) -> Result<AndroidInstallResult, String> {
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
fn get_app_target_abi() -> String {
    #[cfg(target_arch = "aarch64")]
    {
        return "arm64-v8a".to_string();
    }
    #[cfg(target_arch = "arm")]
    {
        return "armeabi-v7a".to_string();
    }
    #[cfg(target_arch = "x86_64")]
    {
        return "x86_64".to_string();
    }
    #[cfg(target_arch = "x86")]
    {
        return "x86".to_string();
    }
    #[cfg(not(any(
        target_arch = "aarch64",
        target_arch = "arm",
        target_arch = "x86_64",
        target_arch = "x86"
    )))]
    {
        "unknown".to_string()
    }
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

#[cfg(desktop)]
#[tauri::command]
fn toggle_devtools(webview: tauri::Webview, enable: bool) -> Result<(), String> {
    if enable {
        webview.open_devtools();
    } else {
        webview.close_devtools();
    }
    Ok(())
}

#[tauri::command]
fn get_audio_proxy_port(state: tauri::State<'_, audio_proxy::AudioProxyPort>) -> u16 {
    state.0
}

/// 获取 Wallpaper Engine 当前壁纸信息
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_wallpaper_engine_background() -> Result<wallpaper_engine::WallpaperInfo, String> {
    wallpaper_engine::get_wallpaper_engine_background()
}

/// 读取 HTML 壁纸文件并注入 WE API shim
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_wallpaper_html_with_shim(html_path: String) -> Result<String, String> {
    wallpaper_engine::get_html_with_shim(&std::path::Path::new(&html_path))
}

/// 检测 Wallpaper Engine 是否正在运行
#[cfg(target_os = "windows")]
#[tauri::command]
fn is_wallpaper_engine_running() -> bool {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_processes();
    sys.processes()
        .iter()
        .any(|(_, p)| {
            let name = p.name().to_string().to_lowercase();
            name == "wallpaper64.exe" || name == "wallpaper32.exe"
        })
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_wallpaper_engine_background() -> Result<wallpaper_engine::WallpaperInfo, String> {
    Err("Wallpaper Engine is only supported on Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_wallpaper_html_with_shim(_html_path: String) -> Result<String, String> {
    Err("Wallpaper Engine is only supported on Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn is_wallpaper_engine_running() -> bool {
    false
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
                        get_app_target_abi,
                        get_process_info,
                        set_status_bar_style,
                        update_thumbbar_playing_state,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music,
                        get_audio_proxy_port,
                        taskbar_player::open_taskbar_player,
                        taskbar_player::close_taskbar_player,
                        taskbar_player::unpin_taskbar_player,
                        taskbar_player::pin_taskbar_player,
                        taskbar_player::get_taskbar_info,
                        taskbar_player::show_taskbar_drop_zone,
                        taskbar_player::hide_taskbar_drop_zone,
                        taskbar_player::is_left_mouse_button_pressed,
                        open_recommend_popup,
                        close_recommend_popup,
                        open_table_player,
                        close_table_player,
                        toggle_table_player_pin,
                        get_table_player_pin_state,
                        toggle_devtools,
                        get_wallpaper_engine_background,
                        get_wallpaper_html_with_shim,
                        is_wallpaper_engine_running
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
                        get_app_target_abi,
                        get_process_info,
                        set_status_bar_style,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music,
                        get_audio_proxy_port,
                        taskbar_player::open_taskbar_player,
                        taskbar_player::close_taskbar_player,
                        taskbar_player::unpin_taskbar_player,
                        taskbar_player::pin_taskbar_player,
                        taskbar_player::get_taskbar_info,
                        taskbar_player::show_taskbar_drop_zone,
                        taskbar_player::hide_taskbar_drop_zone,
                        taskbar_player::is_left_mouse_button_pressed,
                        open_recommend_popup,
                        close_recommend_popup,
                        toggle_table_player_pin,
                        get_table_player_pin_state,
                        toggle_devtools,
                        get_wallpaper_engine_background,
                        get_wallpaper_html_with_shim,
                        is_wallpaper_engine_running
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
                        get_app_target_abi,
                        get_process_info,
                        set_status_bar_style,
                        android_media_notification_update,
                        android_media_notification_hide,
                        android_lyric_notification_update,
                        android_lyric_notification_hide,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music,
                        get_audio_proxy_port,
                        taskbar_player::open_taskbar_player,
                        taskbar_player::close_taskbar_player
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
                        get_app_target_abi,
                        get_process_info,
                        set_status_bar_style,
                        local_music::scan_music_folder,
                        local_music::get_audio_metadata,
                        local_music::read_lrc_file,
                        local_music::save_mobile_local_music,
                        get_audio_proxy_port,
                        taskbar_player::open_taskbar_player,
                        taskbar_player::close_taskbar_player
                    ]
                }
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                // 不再固定 apply_mica，由前端通过 set_window_material 命令动态设置
                if let Some(main_window) = app.get_webview_window("main") {
                    let app_handle = app.handle().clone();
                    let main_window_clone = main_window.clone();
                    
                    main_window.on_window_event(move |event| {
                        match event {
                            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                                // 如果 table-player 已置顶，跳过位置跟随和最小化隐藏
                                let is_pinned = TABLE_PLAYER_PINNED
                                    .lock()
                                    .map(|v| *v)
                                    .unwrap_or(false);
                                if is_pinned {
                                    return;
                                }

                                if let Some(table_player) = app_handle.get_webview_window("table-player") {
                                    if main_window_clone.is_minimized().unwrap_or(false) {
                                        let _ = table_player.hide();
                                    } else {
                                        if !table_player.is_visible().unwrap_or(true) {
                                            let _ = table_player.show();
                                        }
                                        if let (Ok(pos), Ok(size)) = (main_window_clone.inner_position(), main_window_clone.inner_size()) {
                                            let new_x = pos.x + size.width as i32;
                                            let _ = table_player.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                                                x: new_x,
                                                y: pos.y,
                                            }));
                                            
                                            // Update height to match
                                            if let Ok(tp_size) = table_player.inner_size() {
                                                let _ = table_player.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                                                    width: tp_size.width,
                                                    height: size.height,
                                                }));
                                            }
                                        }
                                    }
                                }
                            }
                            tauri::WindowEvent::CloseRequested { api, .. } => {
                                api.prevent_close();
                                let _ = main_window_clone.hide();
                            }
                            _ => {}
                        }
                    });

                    // Windows: 初始化任务栏缩略图工具栏按钮
                    #[cfg(target_os = "windows")]
                    {
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
                                button: MouseButton::Left,
                                button_state: MouseButtonState::Up,
                                position,
                                ..
                            } => {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("tray") {
                                    let size = window.inner_size().unwrap_or(tauri::PhysicalSize {
                                        width: 200,
                                        height: 130,
                                    });
                                    let window_height = size.height as f64;
                                    let y = position.y - window_height - 10.0;

                                    let _ = window.set_position(tauri::Position::Physical(
                                        tauri::PhysicalPosition {
                                            x: position.x as i32,
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
                            // 右键仅显示窗口，不调用 set_focus()，
                            // 避免与 Windows 系统托盘原生右键消息泵冲突导致卡死
                            TrayIconEvent::Click {
                                button: MouseButton::Right,
                                button_state: MouseButtonState::Up,
                                position,
                                ..
                            } => {
                                let app = tray.app_handle();
                                if let Some(window) = app.get_webview_window("tray") {
                                    let size = window.inner_size().unwrap_or(tauri::PhysicalSize {
                                        width: 200,
                                        height: 130,
                                    });
                                    let window_height = size.height as f64;
                                    let y = position.y - window_height - 10.0;

                                    let _ = window.set_position(tauri::Position::Physical(
                                        tauri::PhysicalPosition {
                                            x: position.x as i32,
                                            y: y as i32,
                                        },
                                    ));
                                    let _ = window.show();
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

            // 启动音频代理服务器（所有平台，用于代理汽水音乐等需绕过防盗链的音频）
            let proxy_port = audio_proxy::start();
            app.manage(audio_proxy::AudioProxyPort(proxy_port));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
