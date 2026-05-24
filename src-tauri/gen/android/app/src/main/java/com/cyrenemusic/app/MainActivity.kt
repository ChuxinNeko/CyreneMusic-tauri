package com.cyrenemusic.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File

class MainActivity : TauriActivity() {
  companion object {
    private const val REQUEST_NOTIFICATION_PERMISSION = 1001
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    requestNotificationPermission()
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
    AndroidMediaNotificationManager.attach(this, webView)
    requestNotificationPermission()
  }

  override fun onDestroy() {
    AndroidMediaNotificationManager.detach(this)
    super.onDestroy()
  }

  fun updateMediaNotification(payloadJson: String) {
    AndroidMediaNotificationManager.updateFromJson(payloadJson)
  }

  fun hideMediaNotification() {
    AndroidMediaNotificationManager.hide()
  }

  fun installApk(filePath: String) {
    runOnUiThread {
      try {
        val file = File(filePath)
        if (!file.exists()) {
          println("[MainActivity] APK 文件不存在: $filePath")
          return@runOnUiThread
        }

        val intent = Intent(Intent.ACTION_VIEW)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
          // Android 7.0 及以上通过 FileProvider 获取 content URI，以符合系统沙盒安全规则
          val apkUri: Uri = FileProvider.getUriForFile(
            this,
            "$packageName.fileprovider",
            file
          )
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          intent.setDataAndType(apkUri, "application/vnd.android.package-archive")
        } else {
          // Android 7.0 以下可直接通过 file 协议 URI 打开
          intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive")
        }

        startActivity(intent)
      } catch (e: Exception) {
        e.printStackTrace()
        println("[MainActivity] 安装 APK 失败: ${e.message}")
      }
    }
  }
}
