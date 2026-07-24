package com.cyrenemusic.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class StatusBarStyleArgs {
  var isDarkText: Boolean = false
}

@InvokeArg
class MediaNotificationArgs {
  var title: String = ""
  var artist: String = ""
  var album: String? = null
  var artworkUrl: String? = null
  var isPlaying: Boolean = false
  var durationMs: Long = 0
  var positionMs: Long = 0
}

@InvokeArg
class LyricNotificationArgs {
  var title: String = ""
  var lyric: String = ""
}

@InvokeArg
class InstallApkArgs {
  var filePath: String = ""
}

data class InstallApkResult(
  val success: Boolean,
  val errorCode: String = "",
  val message: String = "",
  val needsPermission: Boolean = false,
)

@TauriPlugin
class AndroidBridgePlugin(private val activity: Activity) : Plugin(activity) {
  private var pendingInstallPath: String? = null

  @Command
  fun setStatusBarStyle(invoke: Invoke) {
    val args = invoke.parseArgs(StatusBarStyleArgs::class.java)
    activity.runOnUiThread {
      try {
        val controller = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
        controller.isAppearanceLightStatusBars = args.isDarkText
        invoke.resolve()
      } catch (error: Exception) {
        invoke.reject("Failed to update status bar style", error)
      }
    }
  }

  @Command
  fun updateMediaNotification(invoke: Invoke) {
    try {
      AndroidMediaNotificationManager.updateFromJson(invoke.getRawArgs())
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject("Failed to update media notification", error)
    }
  }

  @Command
  fun hideMediaNotification(invoke: Invoke) {
    try {
      AndroidMediaNotificationManager.hide()
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject("Failed to hide media notification", error)
    }
  }

  @Command
  fun updateLyricNotification(invoke: Invoke) {
    try {
      AndroidLyricNotificationManager.updateFromJson(activity, invoke.getRawArgs())
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject("Failed to update lyric notification", error)
    }
  }

  @Command
  fun hideLyricNotification(invoke: Invoke) {
    try {
      AndroidLyricNotificationManager.hide(activity)
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject("Failed to hide lyric notification", error)
    }
  }

  @Command
  fun installApk(invoke: Invoke) {
    val args = invoke.parseArgs(InstallApkArgs::class.java)
    invoke.resolveObject(installApk(args.filePath))
  }

  override fun onResume() {
    val path = pendingInstallPath ?: return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()) {
      pendingInstallPath = null
      installApk(path)
    }
  }

  private fun installApk(filePath: String): InstallApkResult {
    return try {
      val file = File(filePath)
      if (!file.exists()) {
        return InstallApkResult(false, "file_not_found", "安装包不存在：$filePath")
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !activity.packageManager.canRequestPackageInstalls()
      ) {
        pendingInstallPath = filePath
        try {
          activity.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
              .setData(Uri.parse("package:${activity.packageName}"))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
        } catch (error: Exception) {
          return InstallApkResult(
            false,
            "cannot_open_settings",
            "无法打开权限设置：${error.message}",
            true,
          )
        }
        return InstallApkResult(
          false,
          "no_install_permission",
          "需要授予「安装未知来源应用」权限",
          true,
        )
      }

      val apkUri = FileProvider.getUriForFile(
        activity,
        "${activity.packageName}.fileprovider",
        file,
      )
      val intent = Intent(Intent.ACTION_VIEW).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_GRANT_READ_URI_PERMISSION
        setDataAndType(apkUri, "application/vnd.android.package-archive")
      }
      activity.startActivity(intent)
      InstallApkResult(true)
    } catch (error: ActivityNotFoundException) {
      InstallApkResult(false, "activity_not_found", "未找到安装器：${error.message}")
    } catch (error: SecurityException) {
      InstallApkResult(false, "security", "安装被系统拒绝：${error.message}")
    } catch (error: Exception) {
      InstallApkResult(false, "unknown", "安装失败：${error.message}")
    }
  }
}