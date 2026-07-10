#[cfg(target_os = "windows")]
use std::ffi::c_void;
#[cfg(target_os = "windows")]
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "windows")]
use tauri::webview::Color;
#[cfg(target_os = "windows")]
use windows::core::{w, PCSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM, RECT};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, SetWindowRgn};
#[cfg(target_os = "windows")]
use windows::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowExW, FindWindowW, GetClientRect, GetWindowLongPtrW, SendMessageTimeoutW,
    SetParent, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, SMTO_NORMAL,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOZORDER, SWP_SHOWWINDOW, WS_EX_NOACTIVATE,
    WS_OVERLAPPEDWINDOW, WS_POPUP,
};

/// 查找 WorkerW 窗口句柄及其客户区矩形
#[cfg(target_os = "windows")]
fn find_workerw() -> Option<(HWND, RECT)> {
    unsafe {
        let progman = FindWindowW(w!("Progman"), None).unwrap_or_default();
        if progman.0.is_null() {
            return None;
        }

        // 触发 WorkerW 创建
        let _ = SendMessageTimeoutW(
            progman, 0x052C, WPARAM(0), LPARAM(0), SMTO_NORMAL, 1000, None,
        );

        // 查找包含 SHELLDLL_DefView 的 WorkerW
        let mut workerw = HWND::default();
        unsafe extern "system" fn enum_windows_proc(tophandle: HWND, lparam: LPARAM) -> BOOL {
            let p_workerw = lparam.0 as *mut HWND;
            let defview = FindWindowExW(
                tophandle, HWND::default(), w!("SHELLDLL_DefView"), None,
            ).unwrap_or_default();
            if !defview.0.is_null() {
                let target = FindWindowExW(
                    HWND::default(), tophandle, w!("WorkerW"), None,
                ).unwrap_or_default();
                if !target.0.is_null() {
                    *p_workerw = target;
                }
            }
            BOOL(1)
        }
        let _ = EnumWindows(
            Some(enum_windows_proc),
            LPARAM(&mut workerw as *mut HWND as isize),
        );

        if workerw.0.is_null() {
            workerw = progman;
        }

        let mut rect = RECT::default();
        if GetClientRect(workerw, &mut rect).is_err() {
            return None;
        }

        Some((workerw, rect))
    }
}

/// 为桌面覆盖窗口配置无焦点交互，并剥离旧式非客户区样式。
///
/// 关键点：WebView2 创建的窗口默认带有 `WS_OVERLAPPEDWINDOW`，即便
/// Tauri 调用 `set_decorations(false)` 也可能因 DWM 合成残留而绘制出
/// Win7 风格标题栏。这里显式将 `GWL_STYLE` 中所有 overapped 标志位
/// 清除并改设 `WS_POPUP`，彻底消除非客户区。
#[cfg(target_os = "windows")]
fn configure_passive_overlay(hwnd: HWND) {
    unsafe {
        // 剥离 WS_OVERLAPPEDWINDOW（包含 WS_CAPTION、WS_SYSMENU、WS_THICKFRAME、
        // WS_MINIMIZEBOX、WS_MAXIMIZEBOX），改设 WS_POPUP，使窗口完全无装饰。
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let new_style = (style & !(WS_OVERLAPPEDWINDOW.0 as isize)) | WS_POPUP.0 as isize;
        let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);

        // 只保留无焦点扩展样式
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOACTIVATE.0 as isize);

        // 通知系统样式已变更，强制刷新非客户区
        let _ = SetWindowPos(
            hwnd,
            HWND::default(),
            0, 0, 0, 0,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

/// 将全屏歌词层附到 WorkerW（壁纸层），不改变窗口尺寸。
#[cfg(target_os = "windows")]
fn attach_to_workerw(hwnd: HWND, workerw: HWND) {
    configure_passive_overlay(hwnd);
    unsafe {
        let _ = SetParent(hwnd, workerw);
    }
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct AccentPolicy {
    state: u32,
    flags: u32,
    color: u32,
    animation_id: u32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct WindowCompositionAttributeData {
    attribute: u32,
    data: *mut c_void,
    size: usize,
}

#[cfg(target_os = "windows")]
const WCA_ACCENT_POLICY: u32 = 19;
#[cfg(target_os = "windows")]
const ACCENT_ENABLE_ACRYLICBLURBEHIND: u32 = 4;

/// 让 DWM 从桌面层采样并模糊窗口客户区。
///
/// 网页的 `backdrop-filter` 无法跨过 WebView2 采样 Wallpaper Engine，
/// 因此桌面控制条必须维持这层原生 Acrylic 合成。
#[cfg(target_os = "windows")]
fn apply_wallpaper_acrylic(hwnd: HWND) -> Result<(), String> {
    type SetWindowCompositionAttribute = unsafe extern "system" fn(
        HWND,
        *mut WindowCompositionAttributeData,
    ) -> BOOL;

    let user32 = unsafe { GetModuleHandleA(PCSTR(b"user32.dll\0".as_ptr())) }
        .map_err(|error| format!("Failed to load user32.dll: {error}"))?;
    let procedure = unsafe {
        GetProcAddress(user32, PCSTR(b"SetWindowCompositionAttribute\0".as_ptr()))
    }
    .ok_or("SetWindowCompositionAttribute is unavailable")?;
    let set_window_composition_attribute: SetWindowCompositionAttribute =
        unsafe { std::mem::transmute(procedure) };

    let mut policy = AccentPolicy {
        state: ACCENT_ENABLE_ACRYLICBLURBEHIND,
        flags: 0,
        color: 18 | (18 << 8) | (18 << 16) | (12 << 24),
        animation_id: 0,
    };
    let mut data = WindowCompositionAttributeData {
        attribute: WCA_ACCENT_POLICY,
        data: &mut policy as *mut AccentPolicy as *mut c_void,
        size: std::mem::size_of::<AccentPolicy>(),
    };

    if unsafe { set_window_composition_attribute(hwnd, &mut data) }.0 == 0 {
        return Err("Failed to apply wallpaper acrylic composition".to_string());
    }

    Ok(())
}

/// 为原生 Acrylic 窗口建立同一套圆角约束。
///
/// DWM 圆角负责 Windows 11 的抗锯齿边缘；GDI region 是兼容旧系统和
/// 命中测试边界的后备。两者必须在启用 Acrylic 前提交，避免材料先把
/// 整个矩形客户区缓存为模糊表面。
#[cfg(target_os = "windows")]
fn apply_rounded_window_shape(hwnd: HWND, width: i32, height: i32, corner: i32) {
    let _ = unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &DWMWCP_ROUND as *const _ as *const c_void,
            std::mem::size_of_val(&DWMWCP_ROUND) as u32,
        )
    };

    let region = unsafe {
        CreateRoundRectRgn(0, 0, width + 1, height + 1, corner * 2, corner * 2)
    };
    if !region.0.is_null() {
        unsafe {
            let _ = SetWindowRgn(hwnd, region, true);
        }
    }
}

#[cfg(target_os = "windows")]
fn configure_desktop_player_bar(
    window: &tauri::WebviewWindow,
    workerw: HWND,
    screen_rect: RECT,
) -> Result<(), String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let screen_w = screen_rect.right - screen_rect.left;
    let screen_h = screen_rect.bottom - screen_rect.top;
    let bar_w = ((screen_w as f64 * 0.84).min(1024.0 * scale)) as i32;
    let bar_h = (88.0 * scale) as i32;
    let bar_x = (screen_w - bar_w) / 2;
    let bar_y = screen_h - bar_h - (72.0 * scale) as i32;
    let hwnd = window
        .hwnd()
        .map(|handle| HWND(handle.0 as _))
        .map_err(|error| format!("Failed to access desktop player controls: {error}"))?;

    // 该窗口不应暴露任何原生身份文本；即使系统因焦点或层级变化重绘
    // 非客户区，也不能出现创建时遗留的标题。
    let _ = window.set_title("");
    let _ = window.set_decorations(false);
    let _ = window.set_shadow(false);

    // 窗口几何与圆角先于材料建立。这样 Acrylic 只会针对最终的卡片区域
    // 合成，不会保留矩形客户区的模糊边缘。
    configure_passive_overlay(hwnd);
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            workerw,
            bar_x,
            bar_y,
            bar_w,
            bar_h,
            SWP_NOACTIVATE,
        );
    }
    apply_rounded_window_shape(hwnd, bar_w, bar_h, (32.0 * scale) as i32);
    apply_wallpaper_acrylic(hwnd)?;

    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn open_desktop_player(app: AppHandle) -> Result<(), String> {
    // 查找 WorkerW（壁纸层），获取屏幕物理尺寸
    let (workerw, screen_rect) = find_workerw()
        .ok_or("Failed to find WorkerW")?;
    let screen_w = screen_rect.right - screen_rect.left;
    let screen_h = screen_rect.bottom - screen_rect.top;

    // ===== 主窗口（歌词 + 封面），全屏透明 =====
    if let Some(window) = app.get_webview_window("desktop-player") {
        let _ = window.show();
    } else {
        let main_window = WebviewWindowBuilder::new(
            &app, "desktop-player", WebviewUrl::App("desktop-player".into()),
        )
        .title("Desktop Player")
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
        .skip_taskbar(true)
        .focused(false)
        .build()
        .map_err(|e| format!("Failed to create desktop player window: {}", e))?;

        if let Ok(hwnd) = main_window.hwnd() {
            let hwnd = HWND(hwnd.0 as _);
            attach_to_workerw(hwnd, workerw);
            // 主窗口匹配 WorkerW 全屏尺寸
            unsafe {
                let _ = SetWindowPos(
                    hwnd, HWND::default(), 0, 0, screen_w, screen_h,
                    SWP_NOZORDER | SWP_SHOWWINDOW | SWP_NOACTIVATE,
                );
            }
        }
    }
    // ===== 桌面控制条，独立窗口并紧邻壁纸层 =====
    if let Some(window) = app.get_webview_window("desktop-player-bar") {
        configure_desktop_player_bar(&window, workerw, screen_rect)?;
        let _ = window.show();
    } else {
        let bar_window = WebviewWindowBuilder::new(
            &app,
            "desktop-player-bar",
            WebviewUrl::App("desktop-player-bar".into()),
        )
        .title("")
        .resizable(false)
        .decorations(false)
        .shadow(false)
        .visible(false)
        .transparent(true)
        .background_color(Color(0, 0, 0, 0))
        .skip_taskbar(true)
        .focused(false)
        .build()
        .map_err(|e| format!("Failed to create desktop player controls: {}", e))?;

        configure_desktop_player_bar(&bar_window, workerw, screen_rect)?;
        let _ = bar_window.show();
    }

    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn close_desktop_player(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("desktop-player") {
        let _ = window.close();
    }
    if let Some(bar_window) = app.get_webview_window("desktop-player-bar") {
        let _ = bar_window.close();
    }
    Ok(())
}

// ===== 非 Windows 平台 stub =====

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn open_desktop_player(_app: tauri::AppHandle) -> Result<(), String> {
    Err("Desktop player is only supported on Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn close_desktop_player(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}