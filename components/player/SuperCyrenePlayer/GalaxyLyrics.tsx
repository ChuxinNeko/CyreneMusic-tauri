"use client"

import { useEffect, useMemo, useState } from "react"
import { useMotionValue } from "framer-motion"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { INTRO_DELAY, parseLyrics } from "@/components/player/parser"
import { extractDominantHueFromImage } from "@/lib/utils/extractColors"
import GalaxyVisualizer from "./GalaxyVisualizer"
import type { AudioBands } from "./default-core/default-types"
import {
  adaptLyricsForDefault,
  SUPER_CYRENE_DEFAULT_THEME,
} from "./default-core/default-adapter"
import { useDefaultPlaybackClock } from "./default-core/default-playback"
import { findTimelineLine } from "./default-core/default-timeline"

/**
 * 螺旋星系歌词入口 -- 与 DefaultLyrics / PixelLyrics / FlipLyrics 对应。
 *
 * 直接复用 default-core 的歌词解析 / 适配 / 时钟管线，
 * 切换到 GalaxyVisualizer（three.js 螺旋星系）渲染。
 */
export function GalaxyLyrics() {
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

  // 从封面提取「主导色相」驱动星系分层色板（与 AMLL 背景一致：按面积占比而非最艳单点）。
  // 切歌时平滑过渡由 GalaxyScene 内部阻尼完成。
  const [galaxyHue, setGalaxyHue] = useState(258)
  const picUrl = currentTrack?.picUrl
  useEffect(() => {
    if (!picUrl) {
      setGalaxyHue(258)
      return
    }
    let alive = true
    extractDominantHueFromImage(picUrl, 258)
      .then((hue) => {
        if (!alive) return
        setGalaxyHue(hue)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [picUrl])

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
    <GalaxyVisualizer
      currentTime={currentTimeValue}
      currentLineIndex={currentLineIndex}
      lines={lines}
      theme={SUPER_CYRENE_DEFAULT_THEME}
      audioPower={audioPower}
      audioBands={audioBands}
      showText
      seed={currentTrack?.id}
      hue={galaxyHue}
    />
  )
}