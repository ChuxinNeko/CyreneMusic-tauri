#[cfg(target_os = "windows")]
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "windows")]
use tauri::webview::Color;
#[cfg(target_os = "windows")]
use windows::core::w;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::RECT;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GetWindowRect, SetWindowLongPtrW, GWLP_HWNDPARENT, EnumChildWindows, IsWindowVisible
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM};

/// 悬浮模式的窗口尺寸
const TASKBAR_WIDTH: u32 = 280;
const FLOATING_WIDTH: u32 = 380;
const FLOATING_HEIGHT: u32 = 60;
const TASKBAR_X_OFFSET: i32 = 260;

/// 获取任务栏矩形区域
#[cfg(target_os = "windows")]
fn get_taskbar_rect() -> Option<RECT> {
    unsafe {
        let hwnd = FindWindowW(w!("Shell_TrayWnd"), None).ok()?;
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some(rect)
    }
}

/// 获取任务栏窗口句柄
#[cfg(target_os = "windows")]
fn get_taskbar_hwnd() -> Option<windows::Win32::Foundation::HWND> {
    unsafe { FindWindowW(w!("Shell_TrayWnd"), None).ok() }
}

/// 动态获取最优的 X 坐标，寻找最大的可用间隙并居中/靠左/靠右
#[cfg(target_os = "windows")]
fn get_best_taskbar_x(taskbar_rect: &RECT, player_width: u32, position: Option<&str>) -> i32 {
    let pos_str = position.unwrap_or("center");

    // 如果用户明确选择靠右，直接寻找系统托盘(TrayNotifyWnd)并紧贴其左侧
    if pos_str == "right" {
        if let Some(parent_hwnd) = get_taskbar_hwnd() {
            unsafe {
                use windows::Win32::UI::WindowsAndMessaging::FindWindowExW;
                if let Ok(tray) = FindWindowExW(parent_hwnd, HWND(0 as _), w!("TrayNotifyWnd"), None) {
                    if IsWindowVisible(tray).into() {
                        let mut r = RECT::default();
                        if GetWindowRect(tray, &mut r).is_ok() {
                            return r.left - player_width as i32 - 10;
                        }
                    }
                }
            }
        }
        // 如果找不到，则使用经验值回退
        return taskbar_rect.right - player_width as i32 - 200;
    }

    struct Span {
        left: i32,
        right: i32,
    }

    struct EnumData {
        spans: Vec<Span>,
        tb_width: i32,
    }

    let mut data = EnumData {
        spans: Vec::new(),
        tb_width: taskbar_rect.right - taskbar_rect.left,
    };

    unsafe extern "system" fn enum_child_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data_ptr = &mut *(lparam.0 as *mut EnumData);
        if IsWindowVisible(hwnd).into() {
            let mut r = RECT::default();
            if GetWindowRect(hwnd, &mut r).is_ok() {
                let w = r.right - r.left;
                if w > 0 && w < data_ptr.tb_width - 10 {
                    data_ptr.spans.push(Span { left: r.left, right: r.right });
                }
            }
        }
        BOOL(1)
    }

    if let Some(parent_hwnd) = get_taskbar_hwnd() {
        unsafe {
            let data_ptr = &mut data as *mut EnumData;
            let _ = EnumChildWindows(parent_hwnd, Some(enum_child_proc), LPARAM(data_ptr as isize));

            if let Ok(start_hwnd) = FindWindowW(w!("Button"), w!("Start")) {
                if IsWindowVisible(start_hwnd).into() {
                    let mut r = RECT::default();
                    if GetWindowRect(start_hwnd, &mut r).is_ok() {
                        data.spans.push(Span { left: r.left, right: r.right });
                    }
                }
            }
        }
    }

    if data.spans.is_empty() {
        return TASKBAR_X_OFFSET;
    }

    data.spans.sort_by_key(|s| s.left);

    // left 模式：放在任务栏左侧第一段足够宽的空白区正中央
    // （Win11 开始菜单居中布局下，即"天气/小组件"与居中"图标组"之间的空白，
    //   从左往右扫描时会跳过紧贴左缘的天气组件，落点正好在两者中间）
    if pos_str == "left" {
        let mut scan_x = taskbar_rect.left;
        for span in &data.spans {
            let gap = span.left - scan_x;
            if gap >= player_width as i32 {
                return scan_x + (gap - player_width as i32) / 2;
            }
            if span.right > scan_x {
                scan_x = span.right;
            }
        }
        // 扫描到末尾仍未找到合适空白：退回到末段空白居中；再不行则贴最左
        let tail_gap = taskbar_rect.right - scan_x;
        if tail_gap >= player_width as i32 {
            return scan_x + (tail_gap - player_width as i32) / 2;
        }
        return taskbar_rect.left + 8;
    }

    let mut current_x = taskbar_rect.left;
    let mut max_gap = 0;
    let mut best_x = current_x;

    for span in &data.spans {
        let gap = span.left - current_x;
        if gap > max_gap {
            max_gap = gap;
            best_x = current_x;
        }
        if span.right > current_x {
            current_x = span.right;
        }
    }

    let final_gap = taskbar_rect.right - current_x;
    if final_gap > max_gap {
        max_gap = final_gap;
        best_x = current_x;
    }

    if max_gap >= player_width as i32 {
        // left / right 已在前面提前返回，这里只处理默认的居中
        best_x + (max_gap - player_width as i32) / 2
    } else {
        TASKBAR_X_OFFSET
    }
}

/// 任务栏矩形信息（用于前端判断是否拖到了任务栏区域）
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

/// 获取任务栏位置信息，供前端判断拖拽是否在任务栏区域
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn get_taskbar_info() -> Result<TaskbarRect, String> {
    let rect = get_taskbar_rect().ok_or("Failed to find taskbar")?;
    Ok(TaskbarRect {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
    })
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn get_taskbar_info() -> Result<TaskbarRect, String> {
    Err("Taskbar player is only supported on Windows".to_string())
}

/// 从任务栏固定模式切换为悬浮模式
/// - 移除与任务栏的 Owner 关系
/// - 调整窗口尺寸为悬浮模式大小
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn unpin_taskbar_player(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar-player")
        .ok_or("Taskbar player window not found")?;

    // 移除 Owner 关系，使其成为独立窗口
    if let Ok(my_hwnd_raw) = window.hwnd() {
        unsafe {
            SetWindowLongPtrW(
                windows::Win32::Foundation::HWND(my_hwnd_raw.0 as *mut _),
                GWLP_HWNDPARENT,
                0,
            );
        }
    }

    // 悬浮模式下开启置顶
    let _ = window.set_always_on_top(true);

    // 获取当前窗口位置
    let current_pos = window.outer_position().unwrap_or(tauri::PhysicalPosition { x: 100, y: 100 });
    let taskbar_rect = get_taskbar_rect().unwrap_or(RECT { left: 0, top: 0, right: 1920, bottom: 1080 });

    // 计算新位置：移到任务栏上方
    let new_y = taskbar_rect.top - FLOATING_HEIGHT as i32 - 20;
    let new_x = current_pos.x;

    // 切换为悬浮窗口尺寸
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: FLOATING_WIDTH,
        height: FLOATING_HEIGHT,
    })).map_err(|e| format!("Failed to set size: {}", e))?;

    // 移动到任务栏上方
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: new_x,
        y: if new_y < 0 { 100 } else { new_y },
    })).map_err(|e| format!("Failed to set position: {}", e))?;

    // 通知前端已切换为悬浮模式
    let _ = window.emit("taskbar-player:mode-change", "floating");

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn unpin_taskbar_player(_app: tauri::AppHandle) -> Result<(), String> {
    Err("Taskbar player is only supported on Windows".to_string())
}

/// 从悬浮模式切换回任务栏固定模式
/// - 重新设置 Owner 为任务栏
/// - 调整窗口尺寸并定位到任务栏
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn pin_taskbar_player(app: AppHandle, position: Option<String>) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar-player")
        .ok_or("Taskbar player window not found")?;

    // 获取任务栏信息
    let taskbar_hwnd = get_taskbar_hwnd().ok_or("Failed to find taskbar")?;
    let taskbar_rect = get_taskbar_rect().ok_or("Failed to get taskbar rect")?;

    let taskbar_height = (taskbar_rect.bottom - taskbar_rect.top) as u32;

    // 重新设置 Owner 为任务栏
    if let Ok(my_hwnd_raw) = window.hwnd() {
        unsafe {
            SetWindowLongPtrW(
                windows::Win32::Foundation::HWND(my_hwnd_raw.0 as *mut _),
                GWLP_HWNDPARENT,
                taskbar_hwnd.0 as isize,
            );
        }
    }

    // 恢复置顶，否则无法在任务栏上正常显示
    let _ = window.set_always_on_top(true);

    // 恢复为任务栏模式尺寸
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: TASKBAR_WIDTH,
        height: taskbar_height,
    })).map_err(|e| format!("Failed to set size: {}", e))?;

    let target_x = get_best_taskbar_x(&taskbar_rect, TASKBAR_WIDTH, position.as_deref());

    // 重新定位到任务栏
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: target_x,
        y: taskbar_rect.top,
    })).map_err(|e| format!("Failed to set position: {}", e))?;

    // 通知前端已切换为任务栏模式
    let _ = window.emit("taskbar-player:mode-change", "taskbar");

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn pin_taskbar_player(_app: tauri::AppHandle, _position: Option<String>) -> Result<(), String> {
    Err("Taskbar player is only supported on Windows".to_string())
}

/// 打开任务栏播放器
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn open_taskbar_player(app: AppHandle, position: Option<String>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("taskbar-player") {
        let _ = window.show();
        let _ = window.set_focus();
        
        // 如果窗口已经存在，根据最新的设置重新计算位置
        if let Some(rect) = get_taskbar_rect() {
            let target_x = get_best_taskbar_x(&rect, TASKBAR_WIDTH, position.as_deref());
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: target_x,
                y: rect.top,
            }));
        }
        return Ok(());
    }

    // 查找任务栏位置
    let hwnd = get_taskbar_hwnd();
    let mut y = 0;
    let mut height = 60;
    let width = TASKBAR_WIDTH;
    let mut x = TASKBAR_X_OFFSET;

    if let Some(rect) = get_taskbar_rect() {
        y = rect.top;
        height = rect.bottom - rect.top;
        x = get_best_taskbar_x(&rect, width, position.as_deref());
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

    // 设置实际物理尺寸和位置
    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: width as u32,
        height: height as u32,
    }));
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: x as i32,
        y: y as i32,
    }));

    // 将窗口的 Owner 设置为任务栏
    if let Some(parent_hwnd) = hwnd {
        if let Ok(my_hwnd_raw) = window.hwnd() {
            unsafe {
                SetWindowLongPtrW(
                    windows::Win32::Foundation::HWND(my_hwnd_raw.0 as *mut _),
                    GWLP_HWNDPARENT,
                    parent_hwnd.0 as isize,
                );
            }
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn open_taskbar_player(_app: tauri::AppHandle, _position: Option<String>) -> Result<(), String> {
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

/// 显示任务栏 Drop Zone 提示窗
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn show_taskbar_drop_zone(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("taskbar-drop-zone") {
        let _ = window.show();
        return Ok(());
    }

    // 查找任务栏位置
    let hwnd = get_taskbar_hwnd();
    let mut y = 0;
    let mut height = 60;
    let width = TASKBAR_WIDTH;
    let mut x = TASKBAR_X_OFFSET;

    if let Some(rect) = get_taskbar_rect() {
        y = rect.top;
        height = rect.bottom - rect.top;
        x = get_best_taskbar_x(&rect, width, None);
    }

    let window = WebviewWindowBuilder::new(
        &app,
        "taskbar-drop-zone",
        WebviewUrl::App("taskbar-drop-zone".into()),
    )
    .title("Taskbar Drop Zone")
    .resizable(false)
    .focused(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .background_color(Color(0, 0, 0, 0))
    .shadow(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create taskbar drop zone window: {}", e))?;

    // 设置实际物理尺寸和位置
    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: width as u32,
        height: height as u32,
    }));
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: x as i32,
        y: y as i32,
    }));

    // 设置忽略鼠标事件，不阻挡拖拽
    let _ = window.set_ignore_cursor_events(true);

    // 将窗口的 Owner 设置为任务栏
    if let Some(parent_hwnd) = hwnd {
        if let Ok(my_hwnd_raw) = window.hwnd() {
            unsafe {
                SetWindowLongPtrW(
                    windows::Win32::Foundation::HWND(my_hwnd_raw.0 as *mut _),
                    GWLP_HWNDPARENT,
                    parent_hwnd.0 as isize,
                );
            }
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn show_taskbar_drop_zone(_app: tauri::AppHandle) -> Result<(), String> {
    Err("Taskbar drop zone is only supported on Windows".to_string())
}

/// 隐藏任务栏 Drop Zone 提示窗
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn hide_taskbar_drop_zone(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("taskbar-drop-zone") {
        let _ = window.hide();
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn hide_taskbar_drop_zone(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

/// 检查鼠标左键是否被按下
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn is_left_mouse_button_pressed() -> bool {
    unsafe {
        // 如果返回值的高位被置 1，说明按键正被按下（返回值的最高位表示是否被按下）
        windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(
            windows::Win32::UI::Input::KeyboardAndMouse::VK_LBUTTON.0 as i32
        ) < 0
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn is_left_mouse_button_pressed() -> bool {
    false
}