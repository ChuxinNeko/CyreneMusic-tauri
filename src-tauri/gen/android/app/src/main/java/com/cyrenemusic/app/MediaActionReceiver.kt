package com.cyrenemusic.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class MediaActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    AndroidMediaNotificationManager.handleAction(action)
  }
}
