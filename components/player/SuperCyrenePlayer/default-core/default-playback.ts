import { useEffect, useRef } from "react"
import { useMotionValue } from "framer-motion"

const RESYNC_THRESHOLD_SECONDS = 0.35

/** Keeps the Canvas timeline continuous between low-frequency media snapshots. */
export function useDefaultPlaybackClock(playbackTime: number, isPlaying: boolean) {
  const currentTimeValue = useMotionValue(playbackTime)
  const clockRef = useRef({ time: playbackTime, sampledAt: performance.now() })

  useEffect(() => {
    const now = performance.now()
    const renderedTime = clockRef.current.time + (now - clockRef.current.sampledAt) / 1000
    const shouldResync = !isPlaying || Math.abs(playbackTime - renderedTime) > RESYNC_THRESHOLD_SECONDS
    const nextTime = shouldResync ? playbackTime : renderedTime

    clockRef.current = { time: nextTime, sampledAt: now }
    if (shouldResync) currentTimeValue.set(nextTime)
  }, [currentTimeValue, isPlaying, playbackTime])

  useEffect(() => {
    if (!isPlaying) return

    let frameId = 0
    const advance = (now: number) => {
      const { time, sampledAt } = clockRef.current
      currentTimeValue.set(time + (now - sampledAt) / 1000)
      frameId = window.requestAnimationFrame(advance)
    }

    frameId = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frameId)
  }, [currentTimeValue, isPlaying])

  return currentTimeValue
}