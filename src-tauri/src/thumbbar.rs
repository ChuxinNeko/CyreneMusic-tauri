#![cfg(target_os = "windows")]

use std::sync::{Mutex, OnceLock};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, BITMAPINFO,
    BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    ITaskbarList3, TaskbarList, THUMBBUTTON, THB_FLAGS, THB_ICON, THB_TOOLTIP, THBF_ENABLED,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, CreateIconIndirect, GetWindowLongPtrW, RegisterWindowMessageW,
    SetWindowLongPtrW, GWLP_WNDPROC, HICON, ICONINFO, WM_COMMAND, WNDPROC,
};
use windows::core::PCWSTR;

const BTN_ID_PREV: u32 = 0;
const BTN_ID_PLAY_PAUSE: u32 = 1;
const BTN_ID_NEXT: u32 = 2;
const THBN_CLICKED: u16 = 0x1800;

type CommandCallback = Box<dyn Fn(&str) + Send + Sync>;

struct ThumbBarState {
    hwnd: HWND,
    taskbar: Option<ITaskbarList3>,
    icon_prev: HICON,
    icon_play: HICON,
    icon_pause: HICON,
    icon_next: HICON,
    is_playing: bool,
    buttons_added: bool,
    original_wndproc: WNDPROC,
    callback: Option<CommandCallback>,
    taskbar_created_msg: u32,
}

unsafe impl Send for ThumbBarState {}
unsafe impl Sync for ThumbBarState {}

static THUMBBAR: OnceLock<Mutex<ThumbBarState>> = OnceLock::new();

unsafe fn create_simple_icon(shape: &str) -> HICON {
    let width: i32 = 16;
    let height: i32 = 16;

    let bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let hdc = CreateCompatibleDC(None);
    let mut bits: *mut std::ffi::c_void = std::ptr::null_mut();
    let hbm = CreateDIBSection(hdc, &bmi, DIB_RGB_COLORS, &mut bits, None, 0)
        .unwrap_or(HBITMAP::default());

    if !bits.is_null() {
        let pixels = std::slice::from_raw_parts_mut(bits as *mut u32, (width * height) as usize);
        draw_shape(pixels, width as usize, height as usize, shape);
    }

    let mut mask_bits: *mut std::ffi::c_void = std::ptr::null_mut();
    let hbm_mask = CreateDIBSection(hdc, &bmi, DIB_RGB_COLORS, &mut mask_bits, None, 0)
        .unwrap_or(HBITMAP::default());

    let icon_info = ICONINFO {
        fIcon: true.into(),
        xHotspot: 0,
        yHotspot: 0,
        hbmMask: hbm_mask,
        hbmColor: hbm,
    };

    let icon = CreateIconIndirect(&icon_info).unwrap_or(HICON::default());

    let _ = DeleteObject(hbm);
    let _ = DeleteObject(hbm_mask);
    let _ = DeleteDC(hdc);

    icon
}

fn draw_shape(pixels: &mut [u32], w: usize, h: usize, shape: &str) {
    let white: u32 = 0xFFFFFFFF;

    match shape {
        "prev" => {
            // |◀◀ - vertical bar + two left-pointing triangles
            for y in 0..h {
                pixels[y * w + 1] = white;
                pixels[y * w + 2] = white;
                let dy = (y as i32 - h as i32 / 2).unsigned_abs() as usize;
                let extent = if dy < 7 { 7 - dy } else { 0 };
                // Left-pointing: right edge fixed, left edge moves right as dy increases
                let start1 = 8usize.saturating_sub(extent);
                for x in start1..=8 {
                    if x >= 3 { pixels[y * w + x] = white; }
                }
                let start2 = 14usize.saturating_sub(extent);
                for x in start2..=14 {
                    if x >= 9 { pixels[y * w + x] = white; }
                }
            }
        }
        "next" => {
            for y in 0..h {
                let dy = (y as i32 - h as i32 / 2).unsigned_abs() as usize;
                let extent = if dy < 7 { 7 - dy } else { 0 };
                for x in (2..2 + extent).filter(|&x| x < 8) {
                    pixels[y * w + x] = white;
                }
                for x in (7..7 + extent).filter(|&x| x < 13) {
                    pixels[y * w + x] = white;
                }
                pixels[y * w + 13] = white;
                pixels[y * w + 14] = white;
            }
        }
        "play" => {
            for y in 0..h {
                let dy = (y as i32 - h as i32 / 2).unsigned_abs() as usize;
                let extent = if dy < 7 { 7 - dy } else { 0 };
                for x in 4..(4 + extent).min(14) {
                    pixels[y * w + x] = white;
                }
            }
        }
        "pause" => {
            for y in 2..(h - 2) {
                for x in 4..7 {
                    pixels[y * w + x] = white;
                }
                for x in 9..12 {
                    pixels[y * w + x] = white;
                }
            }
        }
        _ => {}
    }
}

unsafe extern "system" fn thumbbar_wndproc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if let Some(state_mutex) = THUMBBAR.get() {
        // Check for TaskbarButtonCreated message
        {
            let state = state_mutex.lock().unwrap();
            if state.taskbar_created_msg != 0 && msg == state.taskbar_created_msg {
                drop(state);
                // Re-add buttons when taskbar is recreated (e.g. explorer.exe restart)
                let mut state = state_mutex.lock().unwrap();
                state.buttons_added = false;
                do_add_buttons(&mut state);
                return LRESULT(0);
            }
        }

        if msg == WM_COMMAND {
            let hi_word = ((wparam.0 >> 16) & 0xFFFF) as u16;
            let lo_word = (wparam.0 & 0xFFFF) as u32;

            if hi_word == THBN_CLICKED {
                let guard = state_mutex.lock().unwrap();
                if let Some(ref cb) = guard.callback {
                    match lo_word {
                        BTN_ID_PREV => cb("prev"),
                        BTN_ID_PLAY_PAUSE => cb("toggle-play"),
                        BTN_ID_NEXT => cb("next"),
                        _ => {}
                    }
                }
                return LRESULT(0);
            }
        }

        let guard = state_mutex.lock().unwrap();
        let orig = guard.original_wndproc;
        drop(guard);
        return CallWindowProcW(orig, hwnd, msg, wparam, lparam);
    }

    LRESULT(0)
}

unsafe fn do_add_buttons(state: &mut ThumbBarState) {
    if state.buttons_added {
        return;
    }

    let Some(ref taskbar) = state.taskbar else {
        return;
    };

    let play_icon = if state.is_playing {
        state.icon_pause
    } else {
        state.icon_play
    };

    let play_tooltip: Vec<u16> = if state.is_playing {
        "暂停\0".encode_utf16().collect()
    } else {
        "播放\0".encode_utf16().collect()
    };
    let prev_tooltip: Vec<u16> = "上一首\0".encode_utf16().collect();
    let next_tooltip: Vec<u16> = "下一首\0".encode_utf16().collect();

    let mut buttons: [THUMBBUTTON; 3] = std::mem::zeroed();

    buttons[0].dwMask = THB_ICON | THB_TOOLTIP | THB_FLAGS;
    buttons[0].iId = BTN_ID_PREV;
    buttons[0].hIcon = state.icon_prev;
    buttons[0].dwFlags = THBF_ENABLED;
    let prev_len = prev_tooltip.len().min(260);
    buttons[0].szTip[..prev_len].copy_from_slice(&prev_tooltip[..prev_len]);

    buttons[1].dwMask = THB_ICON | THB_TOOLTIP | THB_FLAGS;
    buttons[1].iId = BTN_ID_PLAY_PAUSE;
    buttons[1].hIcon = play_icon;
    buttons[1].dwFlags = THBF_ENABLED;
    let play_len = play_tooltip.len().min(260);
    buttons[1].szTip[..play_len].copy_from_slice(&play_tooltip[..play_len]);

    buttons[2].dwMask = THB_ICON | THB_TOOLTIP | THB_FLAGS;
    buttons[2].iId = BTN_ID_NEXT;
    buttons[2].hIcon = state.icon_next;
    buttons[2].dwFlags = THBF_ENABLED;
    let next_len = next_tooltip.len().min(260);
    buttons[2].szTip[..next_len].copy_from_slice(&next_tooltip[..next_len]);

    let result = taskbar.ThumbBarAddButtons(state.hwnd, &buttons);
    if result.is_ok() {
        state.buttons_added = true;
    } else {
        eprintln!("[ThumbBar] ThumbBarAddButtons failed: {:?}", result);
    }
}

/// Must be called from the main/UI thread.
pub fn init_thumbbar(hwnd_raw: isize, callback: CommandCallback) {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        let taskbar: ITaskbarList3 = match CoCreateInstance(&TaskbarList, None, CLSCTX_ALL) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[ThumbBar] Failed to create ITaskbarList3: {:?}", e);
                return;
            }
        };

        let hwnd = HWND(hwnd_raw as *mut std::ffi::c_void);

        let icon_prev = create_simple_icon("prev");
        let icon_play = create_simple_icon("play");
        let icon_pause = create_simple_icon("pause");
        let icon_next = create_simple_icon("next");

        // Register for TaskbarButtonCreated to handle explorer.exe restarts
        let msg_name: Vec<u16> = "TaskbarButtonCreated\0".encode_utf16().collect();
        let taskbar_created_msg = RegisterWindowMessageW(PCWSTR(msg_name.as_ptr()));

        // Subclass the window
        let original = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
        SetWindowLongPtrW(hwnd, GWLP_WNDPROC, thumbbar_wndproc as isize);
        let original_wndproc: WNDPROC = std::mem::transmute(original);

        let state = ThumbBarState {
            hwnd,
            taskbar: Some(taskbar),
            icon_prev,
            icon_play,
            icon_pause,
            icon_next,
            is_playing: false,
            buttons_added: false,
            original_wndproc,
            callback: Some(callback),
            taskbar_created_msg,
        };

        let _ = THUMBBAR.set(Mutex::new(state));

        // Add buttons now
        if let Some(m) = THUMBBAR.get() {
            let mut s = m.lock().unwrap();
            do_add_buttons(&mut s);
        }
    }
}

pub fn update_thumbbar_state(is_playing: bool) {
    let Some(state_mutex) = THUMBBAR.get() else {
        return;
    };
    let mut state = state_mutex.lock().unwrap();

    if state.is_playing == is_playing && state.buttons_added {
        return;
    }
    state.is_playing = is_playing;

    if !state.buttons_added {
        return;
    }

    let Some(ref taskbar) = state.taskbar else {
        return;
    };

    unsafe {
        let play_icon = if is_playing {
            state.icon_pause
        } else {
            state.icon_play
        };

        let play_tooltip: Vec<u16> = if is_playing {
            "暂停\0".encode_utf16().collect()
        } else {
            "播放\0".encode_utf16().collect()
        };

        let mut button: THUMBBUTTON = std::mem::zeroed();
        button.dwMask = THB_ICON | THB_TOOLTIP | THB_FLAGS;
        button.iId = BTN_ID_PLAY_PAUSE;
        button.hIcon = play_icon;
        button.dwFlags = THBF_ENABLED;
        let len = play_tooltip.len().min(260);
        button.szTip[..len].copy_from_slice(&play_tooltip[..len]);

        let _ = taskbar.ThumbBarUpdateButtons(state.hwnd, &[button]);
    }
}