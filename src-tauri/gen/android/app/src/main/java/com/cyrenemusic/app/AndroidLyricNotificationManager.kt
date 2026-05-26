package com.cyrenemusic.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

object AndroidLyricNotificationManager {
    private const val CHANNEL_ID = "cyrene_live_lyric"
    private const val CHANNEL_NAME = "实时歌词 (Live Updates)"
    private const val NOTIFICATION_ID = 1002

    fun updateFromJson(context: Context, payloadJson: String) {
        try {
            val json = JSONObject(payloadJson)
            val title = json.optString("title", "Cyrene Music")
            val lyric = json.optString("lyric", "")
            
            showOrUpdate(context, title, lyric)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun showOrUpdate(context: Context, title: String, lyric: String) {
        ensureNotificationChannel(context)

        // Android 15 Live Updates (Promoted Notifications) requires specific settings
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(lyric)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            // Android 15 Live Updates extra
            .apply {
                extras.putBoolean("android.app.extra.REQUEST_PROMOTED_ONGOING", true)
            }

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
        } catch (e: SecurityException) {
            // Missing POST_NOTIFICATIONS or POST_PROMOTED_NOTIFICATIONS permission
            e.printStackTrace()
        }
    }

    fun hide(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    private fun ensureNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) {
            return
        }

        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT // Must not be MIN for Live Updates
        ).apply {
            description = "展示实时动态歌词"
            setShowBadge(false)
            setSound(null, null) // 静音
            enableVibration(false)
        }
        manager.createNotificationChannel(channel)
    }
}