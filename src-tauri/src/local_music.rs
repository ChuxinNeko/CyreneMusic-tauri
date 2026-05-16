use base64::Engine;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::Serialize;
use std::path::Path;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "aac", "wma", "opus"];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalTrackMetadata {
    pub file_path: String,
    pub name: String,
    pub artists: String,
    pub album: String,
    pub duration: f64,
    pub cover_data_url: Option<String>,
    pub lyric: Option<String>,
}

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn extract_metadata(path: &Path) -> Option<LocalTrackMetadata> {
    let tagged_file = Probe::open(path).ok()?.read().ok()?;

    let properties = tagged_file.properties();
    let duration_secs = properties.duration().as_secs_f64();

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let (name, artists, album, lyric, cover_data_url) = if let Some(tag) = tag {
        let title = tag.title().map(|s| s.to_string()).unwrap_or_default();
        let artist = tag.artist().map(|s| s.to_string()).unwrap_or_default();
        let album_name = tag.album().map(|s| s.to_string()).unwrap_or_default();

        // Extract embedded lyrics (USLT for ID3, LYRICS for Vorbis)
        let lyrics = tag
            .get_string(&ItemKey::Lyrics)
            .map(|s| s.to_string());

        // Extract cover art
        let cover = tag.pictures().first().map(|pic| {
            let mime = match pic.mime_type() {
                Some(lofty::picture::MimeType::Png) => "image/png",
                Some(lofty::picture::MimeType::Jpeg) => "image/jpeg",
                Some(lofty::picture::MimeType::Bmp) => "image/bmp",
                _ => "image/jpeg",
            };
            let b64 = base64::engine::general_purpose::STANDARD.encode(pic.data());
            format!("data:{};base64,{}", mime, b64)
        });

        (title, artist, album_name, lyrics, cover)
    } else {
        (String::new(), String::new(), String::new(), None, None)
    };

    // Fallback: use filename as title if tag title is empty
    let final_name = if name.is_empty() {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string()
    } else {
        name
    };

    Some(LocalTrackMetadata {
        file_path: path.to_string_lossy().to_string(),
        name: final_name,
        artists: if artists.is_empty() { "未知歌手".to_string() } else { artists },
        album: if album.is_empty() { "未知专辑".to_string() } else { album },
        duration: duration_secs,
        cover_data_url,
        lyric,
    })
}

#[tauri::command]
pub async fn scan_music_folder(path: String) -> Result<Vec<LocalTrackMetadata>, String> {
    let folder = Path::new(&path);
    if !folder.is_dir() {
        return Err("指定路径不是有效目录".to_string());
    }

    let mut results = Vec::new();

    for entry in WalkDir::new(folder)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_file() && is_audio_file(entry_path) {
            if let Some(meta) = extract_metadata(entry_path) {
                results.push(meta);
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_audio_metadata(path: String) -> Result<LocalTrackMetadata, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("文件不存在".to_string());
    }
    if !is_audio_file(file_path) {
        return Err("不支持的音频格式".to_string());
    }

    extract_metadata(file_path).ok_or_else(|| "无法读取音频元数据".to_string())
}

#[tauri::command]
pub async fn read_lrc_file(audio_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&audio_path);
    let lrc_path = path.with_extension("lrc");

    if lrc_path.exists() {
        std::fs::read_to_string(&lrc_path)
            .map(Some)
            .map_err(|e| format!("读取 .lrc 文件失败: {}", e))
    } else {
        Ok(None)
    }
}