"use client"

import { invoke } from "@tauri-apps/api/core"
import { Track } from "@/lib/models/track"

type AndroidMediaNotificationPayload = {
  title: string
  artist: string
  album?: string
  artworkUrl?: string
  isPlaying: boolean
  durationMs: number
  positionMs: number
}

function isAndroidTauriRuntime() {
  return typeof window !== "undefined" && /Android/i.test(window.navigator.userAgent)
}

class AndroidMediaNotificationService {
  private lastPayloadKey: string | null = null

  sync(track: Track | null, isPlaying: boolean, currentTime: number, duration: number) {
    if (!isAndroidTauriRuntime()) {
      return
    }

    if (!track) {
      this.hide()
      return
    }

    const payload: AndroidMediaNotificationPayload = {
      title: track.name || "Cyrene Music",
      artist: track.artists || "",
      album: track.album || "",
      artworkUrl: track.picUrl || "",
      isPlaying,
      durationMs: Math.max(0, Math.round(duration * 1000)),
      positionMs: Math.max(0, Math.round(currentTime * 1000)),
    }

    const payloadKey = JSON.stringify(payload)
    if (payloadKey === this.lastPayloadKey) {
      return
    }

    this.lastPayloadKey = payloadKey
    void invoke("android_media_notification_update", { payload }).catch((error) => {
      console.error("[AndroidMediaNotification] Failed to sync native notification:", error)
      this.lastPayloadKey = null
    })
  }

  hide() {
    if (!isAndroidTauriRuntime()) {
      return
    }

    this.lastPayloadKey = null
    void invoke("android_media_notification_hide").catch((error) => {
      console.error("[AndroidMediaNotification] Failed to hide native notification:", error)
    })
  }
}

export const androidMediaNotificationService = new AndroidMediaNotificationService()
export { isAndroidTauriRuntime }
