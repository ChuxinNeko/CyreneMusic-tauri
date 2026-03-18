package com.cyrenemusic.app

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
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
}
