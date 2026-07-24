package com.cyrenemusic.app

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  // 禁用 WryActivity 默认的 WebView goBack() 返回键处理，
  // 由 onBackPressedDispatcher 中的自定义 handler 统一管理（通过 JS 桥接）。
  override val handleBackNavigation: Boolean = false

  companion object {
    private const val REQUEST_NOTIFICATION_PERMISSION = 1001
  }

  private var webViewRef: WebView? = null

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
            // JS 层无人消费：先回退 WebView 历史（SPA 路由返回），
            // 历史到底后才走系统默认行为（退出/回桌面）。
            if (webView.canGoBack()) {
              webView.goBack()
            } else {
              isEnabled = false
              onBackPressedDispatcher.onBackPressed()
              isEnabled = true
            }
          }
        }
      }
    })
  }

  private fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(
        this,
        android.Manifest.permission.POST_NOTIFICATIONS,
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
        REQUEST_NOTIFICATION_PERMISSION,
      )
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
}