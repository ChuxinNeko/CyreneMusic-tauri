"use client"

import { useEffect, useMemo, useState } from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { INTRO_DELAY, parseLyrics } from "@/components/player/parser"
import { extractDominantHueFromImage } from "@/lib/utils/extractColors"
import ChatVisualizer from "./ChatVisualizer"
import {
  adaptLyricsForDefault,
  SUPER_CYRENE_DEFAULT_THEME,
} from "./default-core/default-adapter"
import { useDefaultPlaybackClock } from "./default-core/default-playback"
import { findTimelineLine } from "./default-core/default-timeline"
import { deriveChatTheme } from "./chat-core/chat-palette"

/** 无封面时的默认主色相（紫），与星系主题一致 */
const DEFAULT_CHAT_HUE = 258

/**
 * 对话歌词入口 -- 与 DefaultLyrics / PixelLyrics / FlipLyrics / GalaxyLyrics 对应。
 *
 * 复用 default-core 的歌词解析 / 适配 / 时钟管线，
 * 切换到 ChatVisualizer（聊天气泡对话）渲染。
 */
export function ChatLyrics() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  // 右侧发言人使用登录用户头像（与 /setting 账户管理同源：useAuthStore.user.avatarUrl）
  const userAvatarUrl = useAuthStore((state) => state.user?.avatarUrl)

  // 气泡配色从专辑封面主导色相派生（与星系主题同一取色逻辑：按面积主导而非最艳单点）
  const [chatHue, setChatHue] = useState(DEFAULT_CHAT_HUE)
  const picUrl = currentTrack?.picUrl
  useEffect(() => {
    if (!picUrl) {
      setChatHue(DEFAULT_CHAT_HUE)
      return
    }
    let alive = true
    extractDominantHueFromImage(picUrl, DEFAULT_CHAT_HUE)
      .then((hue) => {
        if (alive) setChatHue(hue)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [picUrl])

  const theme = useMemo(
    () => deriveChatTheme(SUPER_CYRENE_DEFAULT_THEME, chatHue),
    [chatHue],
  )

  const sourceLines = useMemo(() => parseLyrics(currentTrack), [currentTrack])
  const lines = useMemo(() => adaptLyricsForDefault(sourceLines), [sourceLines])
  const playbackTime = currentTime + INTRO_DELAY / 1000
  const currentTimeValue = useDefaultPlaybackClock(playbackTime, isPlaying)
  const [currentLineIndex, setCurrentLineIndex] = useState(() => findTimelineLine(lines, playbackTime))

  useEffect(() => {
    const syncLineIndex = (time: number) => {
      const nextIndex = findTimelineLine(lines, time)
      setCurrentLineIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex)
    }

    syncLineIndex(currentTimeValue.get())
    return currentTimeValue.on("change", syncLineIndex)
  }, [currentTimeValue, lines])

  if (lines.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-sm tracking-[0.2em] text-white/30">
        暂无歌词
      </div>
    )
  }

  return (
    <ChatVisualizer
      currentTime={currentTimeValue}
      currentLineIndex={currentLineIndex}
      lines={lines}
      theme={theme}
      showText
      songTitle={currentTrack?.name}
      coverUrl={currentTrack?.picUrl}
      seed={currentTrack?.id}
      rightAvatarUrl={userAvatarUrl}
    />
  )
}