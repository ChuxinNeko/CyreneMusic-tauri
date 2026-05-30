package com.cyrenemusic.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebView
import android.widget.Toast
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
      installApk(pending)
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

  fun installApk(filePath: String) {
    try {
      runOnUiThread {
        try {
          val file = File(filePath)
          if (!file.exists()) {
            toast("安装包不存在：$filePath")
            return@runOnUiThread
          }

          // Android 8.0+ 必须先获得"安装未知应用"权限，否则系统会静默拦截
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !packageManager.canRequestPackageInstalls()
          ) {
            pendingInstallPath = filePath
            toast("请先允许「安装未知来源应用」权限")
            try {
              val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:$packageName"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
              startActivity(settingsIntent)
            } catch (e: Exception) {
              e.printStackTrace()
              toast("无法打开权限设置：${e.message}")
            }
            return@runOnUiThread
          }

          val intent = Intent(Intent.ACTION_VIEW).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
              Intent.FLAG_ACTIVITY_CLEAR_TOP or
              Intent.FLAG_GRANT_READ_URI_PERMISSION
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
              val apkUri: Uri = FileProvider.getUriForFile(
                this@MainActivity,
                "$packageName.fileprovider",
                file
              )
              setDataAndType(apkUri, "application/vnd.android.package-archive")
            } else {
              @Suppress("DEPRECATION")
              setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive")
            }
          }

          startActivity(intent)
        } catch (e: ActivityNotFoundException) {
          e.printStackTrace()
          toast("未找到安装器：${e.message}")
        } catch (e: SecurityException) {
          e.printStackTrace()
          toast("安装被系统拒绝：${e.message}")
        } catch (e: Exception) {
          e.printStackTrace()
          toast("安装失败：${e.message}")
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
      toast("安装APK失败：${e.message}")
    }
  }

  private fun toast(message: String) {
    runOnUiThread {
      Toast.makeText(applicationContext, message, Toast.LENGTH_LONG).show()
    }
  }
}