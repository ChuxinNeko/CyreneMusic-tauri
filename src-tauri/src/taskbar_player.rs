#[cfg(target_os = "windows")]
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "windows")]
use tauri::webview::Color;
#[cfg(target_os = "windows")]
use windows::core::w;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::RECT;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, GetWindowRect, SetWindowLongPtrW, GWLP_HWNDPARENT};

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn open_taskbar_player(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("taskbar-player") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 查找任务栏位置
    let hwnd = unsafe { FindWindowW(w!("Shell_TrayWnd"), None) };
    let mut y = 0;
    let mut height = 60;
    // X坐标：默认从屏幕左侧偏离一点（避开天气组件）
    // 大多数用户的天气组件大概占用 150-200 px
    let x = 260; 
    let width = 280;

    if let Ok(hwnd) = hwnd {
        let mut rect = RECT::default();
        let _ = unsafe { GetWindowRect(hwnd, &mut rect) };
        // Windows 11 默认任务栏在底部
        y = rect.top;
        height = rect.bottom - rect.top;
    }

    let window = WebviewWindowBuilder::new(
        &app,
        "taskbar-player",
        WebviewUrl::App("taskbar".into()),
    )
    .title("Taskbar Player")
    .resizable(false)
    .focused(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .background_color(Color(0, 0, 0, 0))
    .shadow(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create taskbar window: {}", e))?;

    // 设置实际物理尺寸和位置（避免逻辑缩放导致偏离屏幕而被重置为0,0）
    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: width as u32,
        height: height as u32,
    }));
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: x as i32,
        y: y as i32,
    }));

    // 将窗口的 Owner 设置为任务栏，确保它永远不会被任务栏遮挡，且在其他应用最大化时表现符合预期
    if let Ok(parent_hwnd) = hwnd {
        if let Ok(my_hwnd_raw) = window.hwnd() {
            unsafe {
                SetWindowLongPtrW(
                    windows::Win32::Foundation::HWND(my_hwnd_raw.0 as *mut _), 
                    GWLP_HWNDPARENT, 
                    parent_hwnd.0 as isize
                );
            }
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn open_taskbar_player(_app: tauri::AppHandle) -> Result<(), String> {
    Err("Taskbar player is only supported on Windows".to_string())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn close_taskbar_player(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("taskbar-player") {
        let _ = window.close();
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn close_taskbar_player(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}
