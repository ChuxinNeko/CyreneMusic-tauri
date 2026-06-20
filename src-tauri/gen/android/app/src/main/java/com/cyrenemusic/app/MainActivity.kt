package com.cyrenemusic.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebView
import org.json.JSONObject
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowInsetsControllerCompat
import androidx.activity.OnBackPressedCallback
import java.io.File

class MainActivity : TauriActivity() {
  companion object {
    private const val REQUEST_NOTIFICATION_PERMISSION = 1001
  }

  private var webViewRef: WebView? = null
  private var pendingInstallPath: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    WebView.setWebContentsDebuggingEnabled(true)
    requestNotificationPermission()

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val webView = webViewRef
        if (webView == null) {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
          isEnabled = true
          return
        }
        webView.evaluateJavascript(
          "(window.__cyreneOnAndroidBack && window.__cyreneOnAndroidBack()) ? true : false"
        ) { result ->
          if (result != "true") {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
            isEnabled = true
          }
        }
      }
    })
  }

  override fun onResume() {
    super.onResume()
    val pending = pendingInstallPath
    if (pending != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      && packageManager.canRequestPackageInstalls()
    ) {
      pendingInstallPath = null
      installApkSync(pending)
    }
  }

  private fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(
          this, android.Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        ActivityCompat.requestPermissions(
          this,
          arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
          REQUEST_NOTIFICATION_PERMISSION
        )
      }
    }
  }

  fun setStatusBarDarkText(isDark: Boolean) {
    runOnUiThread {
      val insetsController = WindowInsetsControllerCompat(window, window.decorView)
      insetsController.isAppearanceLightStatusBars = isDark
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webViewRef = webView
    AndroidMediaNotificationManager.attach(this, webView)
    requestNotificationPermission()
  }

  override fun onDestroy() {
    AndroidMediaNotificationManager.detach(this)
    webViewRef = null
    super.onDestroy()
  }



  fun updateMediaNotification(payloadJson: String) {
    AndroidMediaNotificationManager.updateFromJson(payloadJson)
  }

  fun hideMediaNotification() {
    AndroidMediaNotificationManager.hide()
  }

  fun updateLyricNotification(payloadJson: String) {
    AndroidLyricNotificationManager.updateFromJson(this, payloadJson)
  }

  fun hideLyricNotification() {
    AndroidLyricNotificationManager.hide(this)
  }

  /**
   * 同步安装 APK，供 Rust 通过 JNI 调用，返回 JSON 结果字符串。
   * 必须同步返回（不使用 runOnUiThread），否则 JNI 调用立即返回 Ok，
   * 主线程上的异常会被吞掉，前端无法感知失败原因。
   */
  fun installApkSync(filePath: String): String {
    fun jsonResult(
      success: Boolean,
      code: String = "",
      msg: String = "",
      needsPerm: Boolean = false
    ): String = JSONObject()
      .put("success", success)
      .put("errorCode", code)
      .put("message", msg)
      .put("needsPermission", needsPerm)
      .toString()

    return try {
      val file = File(filePath)
      if (!file.exists()) {
        return jsonResult(false, "file_not_found", "安装包不存在：$filePath")
      }

      // Android 8.0+ 必须先获得"安装未知应用"权限
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        && !packageManager.canRequestPackageInstalls()
      ) {
        pendingInstallPath = filePath
        // 带 NEW_TASK flag 可在非主线程调用 startActivity
        try {
          startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
              .setData(Uri.parse("package:$packageName"))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
        } catch (e: Exception) {
          e.printStackTrace()
          return jsonResult(false, "cannot_open_settings", "无法打开权限设置：${e.message}", true)
        }
        return jsonResult(false, "no_install_permission", "需要授予「安装未知来源应用」权限", true)
      }

      val intent = Intent(Intent.ACTION_VIEW).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_GRANT_READ_URI_PERMISSION
        val apkUri: Uri = FileProvider.getUriForFile(
          this@MainActivity,
          "$packageName.fileprovider",
          file
        )
        setDataAndType(apkUri, "application/vnd.android.package-archive")
      }
      startActivity(intent)
      jsonResult(true)
    } catch (e: ActivityNotFoundException) {
      e.printStackTrace()
      jsonResult(false, "activity_not_found", "未找到安装器：${e.message}")
    } catch (e: SecurityException) {
      e.printStackTrace()
      jsonResult(false, "security", "安装被系统拒绝：${e.message}")
    } catch (e: Exception) {
      e.printStackTrace()
      jsonResult(false, "unknown", "安装失败：${e.message}")
    }
  }
}