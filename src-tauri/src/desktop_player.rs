#[cfg(target_os = "windows")]
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::ffi::c_void;
#[cfg(target_os = "windows")]
use std::sync::{Mutex, OnceLock};
#[cfg(target_os = "windows")]
use tauri::webview::Color;
#[cfg(target_os = "windows")]
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "windows")]
use windows::core::{w, PCSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, RECT, WPARAM};
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
    CallWindowProcW, EnumChildWindows, EnumWindows, FindWindowExW, FindWindowW, GetClientRect,
    GetWindowLongPtrW, SendMessageTimeoutW, SetParent, SetWindowLongPtrW, SetWindowPos,
    GWLP_WNDPROC, GWL_EXSTYLE, GWL_STYLE, HWND_TOP, MA_NOACTIVATE, SMTO_NORMAL, SWP_FRAMECHANGED,
    SWP_NOACTIVATE, SWP_NOZORDER, SWP_SHOWWINDOW, WM_MOUSEACTIVATE, WM_NCDESTROY, WNDPROC,
    WS_CHILD, WS_EX_NOACTIVATE, WS_OVERLAPPEDWINDOW, WS_POPUP,
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
            progman,
            0x052C,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            None,
        );

        // 查找包含 SHELLDLL_DefView 的 WorkerW
        let mut workerw = HWND::default();
        unsafe extern "system" fn enum_windows_proc(tophandle: HWND, lparam: LPARAM) -> BOOL {
            let p_workerw = lparam.0 as *mut HWND;
            let defview = FindWindowExW(tophandle, HWND::default(), w!("SHELLDLL_DefView"), None)
                .unwrap_or_default();
            if !defview.0.is_null() {
                let target = FindWindowExW(HWND::default(), tophandle, w!("WorkerW"), None)
                    .unwrap_or_default();
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

#[cfg(target_os = "windows")]
static PASSIVE_OVERLAY_WNDPROCS: OnceLock<Mutex<HashMap<isize, WNDPROC>>> = OnceLock::new();

/// 将桌面播放器的鼠标输入与 Windows 的窗口激活分离。
///
/// `WS_EX_NOACTIVATE` 仅改变默认策略，WebView2 的命中路径仍可能触发
/// `WM_MOUSEACTIVATE`。这里明确返回 `MA_NOACTIVATE`：事件继续交给页面，
/// 但不会将壁纸层中的播放器窗口提升为活动窗口。
#[cfg(target_os = "windows")]
unsafe extern "system" fn passive_overlay_wndproc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if message == WM_MOUSEACTIVATE {
        return LRESULT(MA_NOACTIVATE as isize);
    }

    let original = PASSIVE_OVERLAY_WNDPROCS
        .get()
        .and_then(|overlays| overlays.lock().ok()?.get(&(hwnd.0 as isize)).copied());

    let result = match original {
        Some(window_proc) => CallWindowProcW(window_proc, hwnd, message, wparam, lparam),
        None => LRESULT(0),
    };

    if message == WM_NCDESTROY {
        if let Some(overlays) = PASSIVE_OVERLAY_WNDPROCS.get() {
            if let Ok(mut overlays) = overlays.lock() {
                overlays.remove(&(hwnd.0 as isize));
            }
        }
    }

    result
}

#[cfg(target_os = "windows")]
fn install_passive_wndproc(hwnd: HWND) {
    unsafe {
        let overlays = PASSIVE_OVERLAY_WNDPROCS.get_or_init(|| Mutex::new(HashMap::new()));
        let mut overlays = overlays
            .lock()
            .expect("passive overlay window procedure lock");
        if overlays.contains_key(&(hwnd.0 as isize)) {
            return;
        }

        let original = SetWindowLongPtrW(
            hwnd,
            GWLP_WNDPROC,
            passive_overlay_wndproc as *const () as isize,
        );
        overlays.insert(hwnd.0 as isize, std::mem::transmute(original));
    }
}

/// WebView2 的实际命中窗口是桌面播放器窗口的子窗口。
/// 只有父窗口拒绝激活不足以覆盖这条输入路径，因此对子树逐个安装相同策略。
#[cfg(target_os = "windows")]
unsafe extern "system" fn configure_passive_overlay_child(hwnd: HWND, _lparam: LPARAM) -> BOOL {
    install_passive_wndproc(hwnd);
    BOOL(1)
}

/// 为桌面覆盖窗口配置无焦点交互，并剥离旧式非客户区样式。
///
/// 桌面播放器必须是 WorkerW 的子窗口，而不是带 `WS_POPUP` 的独立窗口；
/// 否则 Wallpaper Engine 会在点击后将它误判为活动的全屏应用并暂停动画。
#[cfg(target_os = "windows")]
fn configure_passive_overlay(hwnd: HWND) {
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let new_style = (style & !(WS_OVERLAPPEDWINDOW.0 as isize) & !(WS_POPUP.0 as isize))
            | WS_CHILD.0 as isize;
        let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOACTIVATE.0 as isize);

        install_passive_wndproc(hwnd);
        let _ = EnumChildWindows(hwnd, Some(configure_passive_overlay_child), LPARAM(0));

        let _ = SetWindowPos(
            hwnd,
            HWND::default(),
            0,
            0,
            0,
            0,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

/// 将全屏桌面播放器挂入 WorkerW，使它不会作为独立应用窗口触发壁纸暂停。
#[cfg(target_os = "windows")]
fn attach_to_workerw(hwnd: HWND, workerw: HWND) {
    unsafe {
        let _ = SetParent(hwnd, workerw);
    }
    configure_passive_overlay(hwnd);
}

/// 为独立控制条设置无焦点顶层窗口样式。
///
/// 控制条必须保留顶层 WebView2 窗口形态；将它转为 WorkerW 子窗口会导致
/// WebView2 的合成表面不再绘制。无焦点消息策略仍可阻止其影响动态壁纸。
#[cfg(target_os = "windows")]
fn configure_passive_top_level_overlay(hwnd: HWND) {
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let new_style = (style & !(WS_OVERLAPPEDWINDOW.0 as isize) & !(WS_CHILD.0 as isize))
            | WS_POPUP.0 as isize;
        let _ = SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOACTIVATE.0 as isize);

        install_passive_wndproc(hwnd);
        let _ = EnumChildWindows(hwnd, Some(configure_passive_overlay_child), LPARAM(0));
        let _ = SetWindowPos(
            hwnd,
            HWND::default(),
            0,
            0,
            0,
            0,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
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
    type SetWindowCompositionAttribute =
        unsafe extern "system" fn(HWND, *mut WindowCompositionAttributeData) -> BOOL;

    let user32 = unsafe { GetModuleHandleA(PCSTR(b"user32.dll\0".as_ptr())) }
        .map_err(|error| format!("Failed to load user32.dll: {error}"))?;
    let procedure =
        unsafe { GetProcAddress(user32, PCSTR(b"SetWindowCompositionAttribute\0".as_ptr())) }
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

    let region = unsafe { CreateRoundRectRgn(0, 0, width + 1, height + 1, corner * 2, corner * 2) };
    if !region.0.is_null() {
        unsafe {
            let _ = SetWindowRgn(hwnd, region, true);
        }
    }
}

#[cfg(target_os = "windows")]
fn configure_desktop_player_bar(
    window: &tauri::WebviewWindow,
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

    // 控制条需要作为独立 WebView2 窗口渲染，但不允许激活。
    configure_passive_top_level_overlay(hwnd);
    unsafe {
        let _ = SetWindowPos(hwnd, HWND_TOP, bar_x, bar_y, bar_w, bar_h, SWP_NOACTIVATE);
    }
    apply_rounded_window_shape(hwnd, bar_w, bar_h, (32.0 * scale) as i32);
    apply_wallpaper_acrylic(hwnd)?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn configure_desktop_player_main(
    window: &tauri::WebviewWindow,
    workerw: HWND,
    screen_w: i32,
    screen_h: i32,
) -> Result<(), String> {
    let hwnd = window
        .hwnd()
        .map(|handle| HWND(handle.0 as _))
        .map_err(|error| format!("Failed to access desktop player overlay: {error}"))?;

    attach_to_workerw(hwnd, workerw);
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            HWND::default(),
            0,
            0,
            screen_w,
            screen_h,
            SWP_NOZORDER | SWP_SHOWWINDOW | SWP_NOACTIVATE,
        );
    }

    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn open_desktop_player(app: AppHandle) -> Result<(), String> {
    // 查找 WorkerW（壁纸层），获取屏幕物理尺寸
    let (workerw, screen_rect) = find_workerw().ok_or("Failed to find WorkerW")?;
    let screen_w = screen_rect.right - screen_rect.left;
    let screen_h = screen_rect.bottom - screen_rect.top;

    // ===== 主窗口（歌词 + 封面），全屏透明 =====
    if let Some(window) = app.get_webview_window("desktop-player") {
        configure_desktop_player_main(&window, workerw, screen_w, screen_h)?;
        let _ = window.show();
    } else {
        let main_window = WebviewWindowBuilder::new(
            &app,
            "desktop-player",
            WebviewUrl::App("desktop-player".into()),
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
                    hwnd,
                    HWND::default(),
                    0,
                    0,
                    screen_w,
                    screen_h,
                    SWP_NOZORDER | SWP_SHOWWINDOW | SWP_NOACTIVATE,
                );
            }
        }
    }
    // ===== 桌面控制条，独立窗口并紧邻壁纸层 =====
    if let Some(window) = app.get_webview_window("desktop-player-bar") {
        configure_desktop_player_bar(&window, screen_rect)?;
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

        configure_desktop_player_bar(&bar_window, screen_rect)?;
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
