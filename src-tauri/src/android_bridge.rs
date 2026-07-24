#[cfg(target_os = "android")]
use serde::{de::DeserializeOwned, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};
#[cfg(target_os = "android")]
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Manager,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.cyrenemusic.app";

#[cfg(target_os = "android")]
#[derive(Debug)]
pub struct AndroidBridge<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "android")]
impl<R: Runtime> AndroidBridge<R> {
    fn invoke<T: DeserializeOwned>(
        &self,
        command: &str,
        payload: impl Serialize,
    ) -> Result<T, String> {
        self.0
            .run_mobile_plugin(command, payload)
            .map_err(|error| error.to_string())
    }

    pub fn set_status_bar_style(&self, is_dark_text: bool) -> Result<(), String> {
        self.invoke(
            "setStatusBarStyle",
            serde_json::json!({ "isDarkText": is_dark_text }),
        )
    }

    pub fn update_media_notification<T: Serialize>(&self, payload: &T) -> Result<(), String> {
        self.invoke("updateMediaNotification", payload)
    }

    pub fn hide_media_notification(&self) -> Result<(), String> {
        self.invoke("hideMediaNotification", serde_json::json!({}))
    }

    pub fn update_lyric_notification<T: Serialize>(&self, payload: &T) -> Result<(), String> {
        self.invoke("updateLyricNotification", payload)
    }

    pub fn hide_lyric_notification(&self) -> Result<(), String> {
        self.invoke("hideLyricNotification", serde_json::json!({}))
    }

    pub fn install_apk<T: DeserializeOwned>(&self, file_path: &str) -> Result<T, String> {
        self.invoke("installApk", serde_json::json!({ "filePath": file_path }))
    }
}

#[cfg(target_os = "android")]
fn init_android<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<AndroidBridge<R>, Box<dyn std::error::Error>> {
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "AndroidBridgePlugin")?;
    Ok(AndroidBridge(handle))
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    let builder = Builder::new("android-bridge");

    #[cfg(target_os = "android")]
    let builder = builder.setup(|app, api| {
        let bridge = init_android(app, api)?;
        app.manage(bridge);
        Ok(())
    });

    builder.build()
}
