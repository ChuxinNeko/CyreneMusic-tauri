"use client"

import { useEffect, useMemo, useState } from "react"
import { useMotionValue } from "framer-motion"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { INTRO_DELAY, parseLyrics } from "@/components/player/parser"
import PixelVisualizer from "./PixelVisualizer"
import type { AudioBands } from "./pixel-core/pixel-types"
import {
  adaptLyricsForDefault,
  SUPER_CYRENE_DEFAULT_THEME,
} from "./default-core/default-adapter"
import { useDefaultPlaybackClock } from "./default-core/default-playback"
import { findTimelineLine } from "./default-core/default-timeline"

/**
 * 像素歌词入口 —— 与 DefaultLyrics 对应
 *
 * 直接复用 default-core 的歌词解析/适配/时钟管线，
 * 切换到 PixelVisualizer（移植自 folia 镜台）渲染。
 */
export function PixelLyrics() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const isPlaying = usePlayerStore((state) => state.isPlaying)

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

  const audioPower = useMotionValue(0)
  const bass = useMotionValue(0)
  const lowMid = useMotionValue(0)
  const mid = useMotionValue(0)
  const vocal = useMotionValue(0)
  const treble = useMotionValue(0)
  const audioBands = useMemo<AudioBands>(
    () => ({ bass, lowMid, mid, vocal, treble }),
    [bass, lowMid, mid, vocal, treble],
  )

  if (lines.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-sm tracking-[0.2em] text-white/30">
        暂无歌词
      </div>
    )
  }

  return (
    <PixelVisualizer
      currentTime={currentTimeValue}
      currentLineIndex={currentLineIndex}
      lines={lines}
      theme={SUPER_CYRENE_DEFAULT_THEME}
      audioPower={audioPower}
      audioBands={audioBands}
      showText
      seed={currentTrack?.id}
    />
  )
}