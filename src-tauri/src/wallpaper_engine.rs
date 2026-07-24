use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::System;

/// Wallpaper Engine 壁纸信息
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperInfo {
    /// 壁纸类型: "video", "image", "html", "scene", "unsupported"
    pub wallpaper_type: String,
    /// 入口文件路径（视频/图片/HTML 的绝对路径，或 scene 的 pkg 路径）
    pub entry_path: String,
    /// 原始项目名称
    pub name: String,
}

/// 获取 Wallpaper Engine 当前壁纸信息
pub fn get_wallpaper_engine_background() -> Result<WallpaperInfo, String> {
    // 1. 获取 WE 安装目录（从运行中的 wallpaper64.exe 进程）
    let we_install_dir = get_we_install_dir()?;

    // 2. 读取 config.json
    let config_path = we_install_dir.join("config.json");
    if !config_path.exists() {
        return Err(format!("Config not found: {}", config_path.display()));
    }

    let config_content =
        fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;
    let config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;

    // 3. 配置结构: { "<steam_user_id>": { "general": { "wallpaperconfig": { "selectedwallpapers": { "Monitor0": { "file": "..." } } } } } }
    //    遍历所有用户 ID，找到第一个有 selectedwallpapers 的
    let wallpaper_file_path = find_active_wallpaper_path(&config)?;

    // 4. 将路径中的正斜杠转换为系统分隔符
    let wallpaper_file_path =
        PathBuf::from(wallpaper_file_path.replace('/', std::path::MAIN_SEPARATOR_STR));

    if !wallpaper_file_path.exists() {
        return Err(format!(
            "Wallpaper file not found: {}",
            wallpaper_file_path.display()
        ));
    }

    // 5. 在壁纸文件所在目录查找 project.json
    let wallpaper_dir = wallpaper_file_path
        .parent()
        .ok_or("Invalid wallpaper path")?;
    let project_json_path = wallpaper_dir.join("project.json");

    if !project_json_path.exists() {
        return Err(format!(
            "project.json not found in {}",
            wallpaper_dir.display()
        ));
    }

    parse_project_and_find_entry(&project_json_path, &wallpaper_file_path)
}

/// 从运行中的 wallpaper64.exe 进程获取 WE 安装目录
fn get_we_install_dir() -> Result<PathBuf, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();

    // 查找 wallpaper64.exe 进程
    for (pid, process) in sys.processes() {
        let name = process.name().to_string().to_lowercase();
        if name == "wallpaper64.exe" || name == "wallpaper32.exe" {
            if let Some(exe_path) = process.exe() {
                if let Some(parent) = exe_path.parent() {
                    return Ok(parent.to_path_buf());
                }
            }
        }
        let _ = pid;
    }

    Err("Wallpaper Engine process not found. Is it running?".to_string())
}

/// 从配置 JSON 中找到当前活动的壁纸文件路径
/// 配置结构: { "<steam_user_id>": { "general": { "wallpaperconfig": { "selectedwallpapers": { "Monitor0": { "file": "..." } } } } } }
fn find_active_wallpaper_path(config: &serde_json::Value) -> Result<String, String> {
    // 遍历所有用户 ID
    let obj = config.as_object().ok_or("Config is not an object")?;

    for (_user_id, user_config) in obj {
        // 获取 general.wallpaperconfig.selectedwallpapers
        let selected = user_config
            .get("general")
            .and_then(|g| g.get("wallpaperconfig"))
            .and_then(|wc| wc.get("selectedwallpapers"))
            .ok_or("Cannot find selectedwallpapers in config")?;

        // 尝试获取 Monitor0 的 file 字段
        if let Some(monitor0) = selected.get("Monitor0") {
            if let Some(file) = monitor0.get("file").and_then(|f| f.as_str()) {
                return Ok(file.to_string());
            }
        }

        // 如果没有 Monitor0，尝试获取第一个可用的 monitor
        if let Some(monitors) = selected.as_object() {
            for (_monitor_key, monitor_config) in monitors {
                if let Some(file) = monitor_config.get("file").and_then(|f| f.as_str()) {
                    return Ok(file.to_string());
                }
            }
        }
    }

    Err("No active wallpaper found in config".to_string())
}

/// 解析 project.json 并返回壁纸信息
fn parse_project_and_find_entry(
    project_path: &Path,
    wallpaper_file: &Path,
) -> Result<WallpaperInfo, String> {
    let content = fs::read_to_string(project_path)
        .map_err(|e| format!("Failed to read project.json: {}", e))?;
    let project: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project.json: {}", e))?;

    let name = project
        .get("title")
        .and_then(|n| n.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let wallpaper_type = project
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unsupported")
        .to_string();

    // 对于 HTML 类型，使用 project.json 中的 "file" 字段作为入口
    // 对于其他类型，使用配置中指定的壁纸文件
    let entry_path = if wallpaper_type == "html" {
        // HTML 壁纸: project.json 的 "file" 字段指向 HTML 入口
        let html_file = project
            .get("file")
            .and_then(|f| f.as_str())
            .ok_or("HTML wallpaper missing 'file' field in project.json")?;
        let base_dir = project_path.parent().ok_or("Invalid project path")?;
        base_dir.join(html_file)
    } else {
        // 其他类型: 使用配置中的文件路径
        wallpaper_file.to_path_buf()
    };

    if !entry_path.exists() {
        return Err(format!("Entry file not found: {}", entry_path.display()));
    }

    Ok(WallpaperInfo {
        wallpaper_type,
        entry_path: entry_path.to_string_lossy().to_string(),
        name,
    })
}

/// 读取 HTML 壁纸文件并注入 WE API shim
pub fn get_html_with_shim(html_path: &Path) -> Result<String, String> {
    let content =
        fs::read_to_string(html_path).map_err(|e| format!("Failed to read HTML file: {}", e))?;

    // WE API shim 脚本 - mock Wallpaper Engine 专有 API
    let shim_script = r#"
<script>
(function() {
    if (window.__wallpaperShimmed) return;
    window.__wallpaperShimmed = true;

    window.wallpaperRegisterAudioListener = function(callback) {
        window.__wallpaperAudioCallback = callback;
        setTimeout(function() {
            if (window.__wallpaperAudioCallback) {
                window.__wallpaperAudioCallback({ frequencies: new Array(128).fill(0), average: 0, peak: 0 });
            }
        }, 100);
    };

    window.wallpaperPropertyApply = function(properties) {};

    window.wallpaperRegisterTimeUpdateListener = function(callback) {
        window.__wallpaperTimeCallback = callback;
        setInterval(function() {
            if (window.__wallpaperTimeCallback) {
                window.__wallpaperTimeCallback(Date.now() / 1000);
            }
        }, 1000);
    };

    window.wallpaperRegisterGeneralEventListener = function(callback) {
        window.__wallpaperEventCallback = callback;
    };

    window.userInterface = {
        setProgress: function() {},
        setLoadingPercentage: function() {},
        showBackground: function() {}
    };

    window.wallpaperPlugin = { requestUpdate: function() {} };
    window.wallpaperRegisterPlugin = function(plugin) {};
    window.wallpaperRegisterEffect = function(effect) {};

    console.log('[WallpaperBackground] WE API shim injected');
})();
</script>
"#;

    // 在 </head> 或 </body> 前插入 shim
    if content.contains("</head>") {
        Ok(content.replace("</head>", &format!("{}\n</head>", shim_script)))
    } else if content.contains("</body>") {
        Ok(content.replace("</body>", &format!("{}\n</body>", shim_script)))
    } else {
        Ok(format!("{}\n{}", content, shim_script))
    }
}
