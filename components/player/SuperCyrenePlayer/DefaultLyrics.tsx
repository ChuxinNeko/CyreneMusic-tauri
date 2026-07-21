"use client"

import { useMemo } from "react"
import { useMotionValue } from "framer-motion"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { INTRO_DELAY, parseLyrics } from "@/components/player/parser"
import DefaultCanvas from "./default-core/DefaultCanvas"
import type { AudioBands } from "./default-core/default-types"
import { adaptLyricsForDefault, SUPER_CYRENE_DEFAULT_THEME, SUPER_CYRENE_DEFAULT_TUNING } from "./default-core/default-adapter"
import { useDefaultPlaybackClock } from "./default-core/default-playback"
import { findTimelineLine } from "./default-core/default-timeline"

export function DefaultLyrics() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const currentTime = usePlayerStore((state) => state.currentTime)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const sourceLines = useMemo(
    () => parseLyrics(currentTrack),
    [currentTrack],
  )
  const lines = useMemo(() => adaptLyricsForDefault(sourceLines), [sourceLines])
  const playbackTime = currentTime + INTRO_DELAY / 1000
  const currentTimeValue = useDefaultPlaybackClock(playbackTime, isPlaying)
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
    <DefaultCanvas
      currentTime={currentTimeValue}
      currentLineIndex={findTimelineLine(lines, playbackTime)}
      lines={lines}
      theme={SUPER_CYRENE_DEFAULT_THEME}
      audioPower={audioPower}
      audioBands={audioBands}
      showText
      paused={!isPlaying}
      seed={currentTrack?.id}
      defaultTuning={SUPER_CYRENE_DEFAULT_TUNING}
    />
  )
}