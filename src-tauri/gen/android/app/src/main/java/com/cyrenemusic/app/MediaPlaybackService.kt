package com.cyrenemusic.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.net.wifi.WifiManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.Executors

private data class MediaPlaybackPayload(
  val title: String,
  val artist: String,
  val album: String?,
  val artworkUrl: String?,
  val isPlaying: Boolean,
  val durationMs: Long,
  val positionMs: Long,
)

class MediaPlaybackService : Service() {
  companion object {
    const val CHANNEL_ID = "cyrene_media_playback"
    const val CHANNEL_NAME = "Media playback"
    const val NOTIFICATION_ID = 1001

    const val ACTION_UPDATE = "com.cyrenemusic.app.action.MEDIA_SERVICE_UPDATE"
    const val ACTION_HIDE = "com.cyrenemusic.app.action.MEDIA_SERVICE_HIDE"
    const val EXTRA_PAYLOAD_JSON = "payloadJson"
  }

  private var mediaSession: MediaSessionCompat? = null
  private var lastPayload: MediaPlaybackPayload? = null
  private var cachedArtworkUrl: String? = null
  private var cachedArtworkBitmap: Bitmap? = null
  private val artworkExecutor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel()
    ensureMediaSession()

    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CyreneMusic::MediaPlaybackWakeLock")

    val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "CyreneMusic::MediaPlaybackWifiLock")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_UPDATE -> {
        val payloadJson = intent.getStringExtra(EXTRA_PAYLOAD_JSON)
        if (payloadJson.isNullOrBlank()) {
          stopForegroundAndSelf()
          return START_NOT_STICKY
        }
        updateFromJson(payloadJson)
      }
      ACTION_HIDE -> stopForegroundAndSelf()
      else -> stopForegroundAndSelf()
    }

    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    if (wakeLock?.isHeld == true) wakeLock?.release()
    if (wifiLock?.isHeld == true) wifiLock?.release()

    mediaSession?.isActive = false
    mediaSession?.release()
    mediaSession = null
    super.onDestroy()
  }

  private fun updateFromJson(payloadJson: String) {
    val payload = parsePayload(payloadJson)
    lastPayload = payload

    val artworkBitmap = if (payload.artworkUrl != null && payload.artworkUrl == cachedArtworkUrl) {
      cachedArtworkBitmap
    } else {
      null
    }

    ensureMediaSession()
    updatePlaybackState(payload)
    updateMetadata(payload, artworkBitmap)
    postForegroundNotification(payload, artworkBitmap)
    maybeLoadArtwork(payload)
  }

  private fun parsePayload(payloadJson: String): MediaPlaybackPayload {
    val json = JSONObject(payloadJson)
    return MediaPlaybackPayload(
      title = json.optString("title", "Cyrene Music"),
      artist = json.optString("artist", ""),
      album = json.optString("album").takeIf { it.isNotBlank() },
      artworkUrl = json.optString("artworkUrl").takeIf { it.isNotBlank() },
      isPlaying = json.optBoolean("isPlaying", false),
      durationMs = json.optLong("durationMs", 0),
      positionMs = json.optLong("positionMs", 0),
    )
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) {
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

  private fun canPostNotifications(): Boolean {
    val hasRuntimePermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(
        this,
        android.Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED

    return hasRuntimePermission && NotificationManagerCompat.from(this).areNotificationsEnabled()
  }

  private fun ensureMediaSession() {
    if (mediaSession != null) {
      return
    }

    mediaSession = MediaSessionCompat(this, "CyreneMediaSession").apply {
      setFlags(
        MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
          MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS,
      )
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() {
          AndroidMediaNotificationManager.handleAction(AndroidMediaNotificationManager.ACTION_TOGGLE_PLAYBACK)
        }

        override fun onPause() {
          AndroidMediaNotificationManager.handleAction(AndroidMediaNotificationManager.ACTION_TOGGLE_PLAYBACK)
        }

        override fun onSkipToNext() {
          AndroidMediaNotificationManager.handleAction(AndroidMediaNotificationManager.ACTION_NEXT)
        }

        override fun onSkipToPrevious() {
          AndroidMediaNotificationManager.handleAction(AndroidMediaNotificationManager.ACTION_PREVIOUS)
        }
      })
      isActive = true
    }
  }

  private fun updatePlaybackState(payload: MediaPlaybackPayload) {
    val session = mediaSession ?: return
    val supportedActions =
      PlaybackStateCompat.ACTION_PLAY or
        PlaybackStateCompat.ACTION_PAUSE or
        PlaybackStateCompat.ACTION_PLAY_PAUSE or
        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS

    val state = if (payload.isPlaying) {
      if (wakeLock?.isHeld == false) wakeLock?.acquire()
      if (wifiLock?.isHeld == false) wifiLock?.acquire()
      PlaybackStateCompat.STATE_PLAYING
    } else {
      if (wakeLock?.isHeld == true) wakeLock?.release()
      if (wifiLock?.isHeld == true) wifiLock?.release()
      PlaybackStateCompat.STATE_PAUSED
    }

    val playbackState = PlaybackStateCompat.Builder()
      .setActions(supportedActions)
      .setState(state, payload.positionMs, if (payload.isPlaying) 1f else 0f)
      .build()

    session.setPlaybackState(playbackState)
    session.isActive = true
  }

  private fun updateMetadata(payload: MediaPlaybackPayload, artworkBitmap: Bitmap?) {
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

  private fun maybeLoadArtwork(payload: MediaPlaybackPayload) {
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

        val currentPayload = lastPayload ?: return@onSuccess
        mainHandler.post {
          updateMetadata(currentPayload, bitmap)
          postForegroundNotification(currentPayload, bitmap)
        }
      }
    }
  }

  private fun postForegroundNotification(payload: MediaPlaybackPayload, artworkBitmap: Bitmap?) {
    if (!canPostNotifications()) {
      stopForegroundAndSelf()
      return
    }

    val notification = buildNotification(payload, artworkBitmap)
    runCatching {
      startForeground(NOTIFICATION_ID, notification)
    }.onFailure {
      stopForegroundAndSelf()
    }
  }

  private fun buildNotification(payload: MediaPlaybackPayload, artworkBitmap: Bitmap?): Notification {
    val session = mediaSession
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val previousAction = NotificationCompat.Action(
      android.R.drawable.ic_media_previous,
      "Previous",
      broadcastPendingIntent(this, AndroidMediaNotificationManager.ACTION_PREVIOUS, 1),
    )
    val toggleAction = NotificationCompat.Action(
      if (payload.isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
      if (payload.isPlaying) "Pause" else "Play",
      broadcastPendingIntent(this, AndroidMediaNotificationManager.ACTION_TOGGLE_PLAYBACK, 2),
    )
    val nextAction = NotificationCompat.Action(
      android.R.drawable.ic_media_next,
      "Next",
      broadcastPendingIntent(this, AndroidMediaNotificationManager.ACTION_NEXT, 3),
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
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
          .also { style ->
            if (session != null) {
              style.setMediaSession(session.sessionToken)
            }
          }
          .setShowActionsInCompactView(0, 1, 2),
      )
      .build()
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

  private fun stopForegroundAndSelf() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    mediaSession?.isActive = false
    stopSelf()
  }
}