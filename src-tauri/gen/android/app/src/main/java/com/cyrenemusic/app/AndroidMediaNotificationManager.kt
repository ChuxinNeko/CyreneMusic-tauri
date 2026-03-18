package com.cyrenemusic.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.net.URL
import java.util.concurrent.Executors

private data class MediaNotificationPayload(
  val title: String,
  val artist: String,
  val album: String?,
  val artworkUrl: String?,
  val isPlaying: Boolean,
  val durationMs: Long,
  val positionMs: Long,
)

object AndroidMediaNotificationManager {
  private const val CHANNEL_ID = "cyrene_media_playback"
  private const val CHANNEL_NAME = "Media playback"
  private const val NOTIFICATION_ID = 1001

  const val ACTION_TOGGLE_PLAYBACK = "com.cyrenemusic.app.action.TOGGLE_PLAYBACK"
  const val ACTION_NEXT = "com.cyrenemusic.app.action.NEXT"
  const val ACTION_PREVIOUS = "com.cyrenemusic.app.action.PREVIOUS"

  private var activityRef = WeakReference<MainActivity>(null)
  private var webViewRef = WeakReference<WebView>(null)
  private var mediaSession: MediaSessionCompat? = null
  private var lastPayload: MediaNotificationPayload? = null
  private var cachedArtworkUrl: String? = null
  private var cachedArtworkBitmap: Bitmap? = null
  private val artworkExecutor = Executors.newSingleThreadExecutor()

  fun attach(activity: MainActivity, webView: WebView) {
    activityRef = WeakReference(activity)
    webViewRef = WeakReference(webView)
    ensureNotificationChannel(activity)
    ensureMediaSession(activity)
  }

  fun detach(activity: MainActivity) {
    if (activityRef.get() === activity) {
      activityRef.clear()
      webViewRef.clear()
    }
  }

  fun updateFromJson(payloadJson: String) {
    val activity = activityRef.get() ?: return
    val payload = parsePayload(payloadJson)
    lastPayload = payload
    val artworkBitmap = if (payload.artworkUrl != null && payload.artworkUrl == cachedArtworkUrl) {
      cachedArtworkBitmap
    } else {
      null
    }

    activity.runOnUiThread {
      ensureNotificationChannel(activity)
      ensureMediaSession(activity)
      updatePlaybackState(payload)
      updateMetadata(payload, artworkBitmap)
      postNotification(activity, payload, artworkBitmap)
    }

    maybeLoadArtwork(payload)
  }

  fun hide() {
    NotificationManagerCompat.from(activityRef.get() ?: return).cancel(NOTIFICATION_ID)
    mediaSession?.isActive = false
  }

  fun handleAction(action: String) {
    when (action) {
      ACTION_TOGGLE_PLAYBACK -> dispatchActionToWeb("toggle-play")
      ACTION_NEXT -> dispatchActionToWeb("next")
      ACTION_PREVIOUS -> dispatchActionToWeb("prev")
    }
  }

  private fun parsePayload(payloadJson: String): MediaNotificationPayload {
    val json = JSONObject(payloadJson)
    return MediaNotificationPayload(
      title = json.optString("title", "Cyrene Music"),
      artist = json.optString("artist", ""),
      album = json.optString("album").takeIf { it.isNotBlank() },
      artworkUrl = json.optString("artworkUrl").takeIf { it.isNotBlank() },
      isPlaying = json.optBoolean("isPlaying", false),
      durationMs = json.optLong("durationMs", 0),
      positionMs = json.optLong("positionMs", 0),
    )
  }

  private fun ensureNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Controls music playback"
      setShowBadge(false)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  private fun ensureMediaSession(context: Context) {
    if (mediaSession != null) {
      return
    }

    mediaSession = MediaSessionCompat(context, "CyreneMediaSession").apply {
      setFlags(
        MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
          MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS,
      )
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() {
          handleAction(ACTION_TOGGLE_PLAYBACK)
        }

        override fun onPause() {
          handleAction(ACTION_TOGGLE_PLAYBACK)
        }

        override fun onSkipToNext() {
          handleAction(ACTION_NEXT)
        }

        override fun onSkipToPrevious() {
          handleAction(ACTION_PREVIOUS)
        }
      })
      isActive = true
    }
  }

  private fun updatePlaybackState(payload: MediaNotificationPayload) {
    val session = mediaSession ?: return
    val supportedActions =
      PlaybackStateCompat.ACTION_PLAY or
        PlaybackStateCompat.ACTION_PAUSE or
        PlaybackStateCompat.ACTION_PLAY_PAUSE or
        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS

    val state = if (payload.isPlaying) {
      PlaybackStateCompat.STATE_PLAYING
    } else {
      PlaybackStateCompat.STATE_PAUSED
    }

    val playbackState = PlaybackStateCompat.Builder()
      .setActions(supportedActions)
      .setState(state, payload.positionMs, if (payload.isPlaying) 1f else 0f)
      .build()

    session.setPlaybackState(playbackState)
    session.isActive = true
  }

  private fun updateMetadata(payload: MediaNotificationPayload, artworkBitmap: Bitmap?) {
    val session = mediaSession ?: return
    val metadata = MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, payload.title)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, payload.artist)
      .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, payload.album ?: "")
      .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, payload.durationMs)
      .apply {
        if (artworkBitmap != null) {
          putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artworkBitmap)
          putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artworkBitmap)
        }
      }
      .build()

    session.setMetadata(metadata)
  }

  private fun maybeLoadArtwork(payload: MediaNotificationPayload) {
    val artworkUrl = payload.artworkUrl ?: return
    if (artworkUrl == cachedArtworkUrl && cachedArtworkBitmap != null) {
      return
    }

    artworkExecutor.execute {
      runCatching {
        URL(artworkUrl).openStream().use(BitmapFactory::decodeStream)
      }.onSuccess { bitmap ->
        if (bitmap == null || lastPayload?.artworkUrl != artworkUrl) {
          return@onSuccess
        }

        cachedArtworkUrl = artworkUrl
        cachedArtworkBitmap = bitmap

        val activity = activityRef.get() ?: return@onSuccess
        val currentPayload = lastPayload ?: return@onSuccess
        activity.runOnUiThread {
          updateMetadata(currentPayload, bitmap)
          postNotification(activity, currentPayload, bitmap)
        }
      }
    }
  }

  private fun postNotification(
    context: Context,
    payload: MediaNotificationPayload,
    artworkBitmap: Bitmap?,
  ) {
    val session = mediaSession ?: return
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val previousAction = NotificationCompat.Action(
      android.R.drawable.ic_media_previous,
      "Previous",
      broadcastPendingIntent(context, ACTION_PREVIOUS, 1),
    )
    val toggleAction = NotificationCompat.Action(
      if (payload.isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
      if (payload.isPlaying) "Pause" else "Play",
      broadcastPendingIntent(context, ACTION_TOGGLE_PLAYBACK, 2),
    )
    val nextAction = NotificationCompat.Action(
      android.R.drawable.ic_media_next,
      "Next",
      broadcastPendingIntent(context, ACTION_NEXT, 3),
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(payload.title)
      .setContentText(listOfNotNull(payload.artist.takeIf { it.isNotBlank() }, payload.album).joinToString(" - "))
      .setSubText(payload.album)
      .setLargeIcon(artworkBitmap)
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(payload.isPlaying)
      .setContentIntent(contentIntent)
      .addAction(previousAction)
      .addAction(toggleAction)
      .addAction(nextAction)
      .setStyle(
        MediaStyle()
          .setMediaSession(session.sessionToken)
          .setShowActionsInCompactView(0, 1, 2),
      )
      .build()

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }

  private fun broadcastPendingIntent(
    context: Context,
    action: String,
    requestCode: Int,
  ): PendingIntent {
    val intent = Intent(context, MediaActionReceiver::class.java).apply {
      this.action = action
      setPackage(context.packageName)
    }

    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
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
