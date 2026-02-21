use tauri::Manager;
use base64::Engine;

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
    .inner_size(800.0, 100.0) // 宽一点以容纳长句，高度矮一点
    // 可以设置一个默认位置，比如屏幕的中下部，或者在前端挂载后自己 resize/set_position
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn close_desktop_lyric(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("desktop-lyric") {
        let _ = window.close();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet, fetch_image, open_desktop_lyric, close_desktop_lyric])
        .setup(|app| {
            #[cfg(desktop)]
            {
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
