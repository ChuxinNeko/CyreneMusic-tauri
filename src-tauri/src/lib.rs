use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                
                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Cyrene Music")
                    .on_tray_icon_event(move |tray, event| match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left | MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            rect,
                            position,
                            ..
                        } => {
                            let app = tray.app_handle();
                            let window = if let Some(window) = app.get_webview_window("tray") {
                                window
                            } else {
                                tauri::WebviewWindowBuilder::new(
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
                                .visible(false)
                                .skip_taskbar(true)
                                .inner_size(200.0, 130.0)
                                .build()
                                .unwrap()
                            };

                            let window_height = 130.0;
                            
                            // User wants "First Quadrant" relative to mouse position.
                            // Standard cartesian 1st quadrant is X+, Y+ (Up-Right).
                            // In screen coords, Y+ is Down, Y- is Up.
                            // So we want X+ (Right), Y- (Up).
                            // Window Left = Mouse X
                            // Window Bottom = Mouse Y  => Window Top = Mouse Y - Window Height
                            
                            // 'position' is a PhysicalPosition<f64> struct, so we can access x and y directly.
                            let click_x = position.x;
                            let click_y = position.y;

                            let x = click_x;
                            let y = click_y - window_height - (window_height * 0.3);

                            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }));
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        _ => {}
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
