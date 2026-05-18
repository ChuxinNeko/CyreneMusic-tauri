package com.cyrenemusic.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.WebView
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.lang.ref.WeakReference

object AndroidMediaNotificationManager {
  const val ACTION_TOGGLE_PLAYBACK = "com.cyrenemusic.app.action.TOGGLE_PLAYBACK"
  const val ACTION_NEXT = "com.cyrenemusic.app.action.NEXT"
  const val ACTION_PREVIOUS = "com.cyrenemusic.app.action.PREVIOUS"

  private var activityRef = WeakReference<MainActivity>(null)
  private var webViewRef = WeakReference<WebView>(null)

  fun attach(activity: MainActivity, webView: WebView) {
    activityRef = WeakReference(activity)
    webViewRef = WeakReference(webView)
  }

  fun detach(activity: MainActivity) {
    if (activityRef.get() === activity) {
      activityRef.clear()
      webViewRef.clear()
    }
  }

  fun updateFromJson(payloadJson: String) {
    val context = activityRef.get() ?: return
    if (!canPostNotifications(context)) {
      stopMediaService(context)
      return
    }

    val intent = Intent(context, MediaPlaybackService::class.java).apply {
      action = MediaPlaybackService.ACTION_UPDATE
      putExtra(MediaPlaybackService.EXTRA_PAYLOAD_JSON, payloadJson)
    }

    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(context, intent)
      } else {
        context.startService(intent)
      }
    }
  }

  fun hide() {
    val context = activityRef.get() ?: return
    stopMediaService(context)
  }

  fun handleAction(action: String) {
    when (action) {
      ACTION_TOGGLE_PLAYBACK -> dispatchActionToWeb("toggle-play")
      ACTION_NEXT -> dispatchActionToWeb("next")
      ACTION_PREVIOUS -> dispatchActionToWeb("prev")
    }
  }

  private fun canPostNotifications(context: Context): Boolean {
    val hasRuntimePermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(
        context,
        android.Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED

    return hasRuntimePermission && NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  private fun stopMediaService(context: Context) {
    val intent = Intent(context, MediaPlaybackService::class.java).apply {
      action = MediaPlaybackService.ACTION_HIDE
    }
    runCatching {
      context.startService(intent)
    }
  }

  private fun dispatchActionToWeb(action: String) {
    val webView = webViewRef.get() ?: return
    val js = """
      window.dispatchEvent(new CustomEvent("cyrene:android-media-action", {
        detail: { action: "${action}" }
      }));
    """.trimIndent()

    webView.post {
      webView.evaluateJavascript(js, null)
    }
  }
}