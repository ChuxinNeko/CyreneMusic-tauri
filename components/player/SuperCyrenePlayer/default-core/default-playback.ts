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
    // Track last notified value to skip redundant MotionValue.set() calls.
    // The clock advances continuously, but sub-millisecond deltas don't affect
    // visual output — skipping them avoids firing subscriber callbacks (useMotionValueEvent)
    // that would do binary searches / state comparisons for no observable change.
    let lastNotifiedTime = currentTimeValue.get()
    const MIN_NOTIFY_DELTA = 0.004 // 4ms threshold — below this, no visual difference

    const advance = (now: number) => {
      const { time, sampledAt } = clockRef.current
      const nextTime = time + (now - sampledAt) / 1000
      // Only push an update to subscribers when the clock has moved
      // meaningfully. Effects read currentTime.get() inside their own rAF
      // loops, so they always get the latest value regardless — this throttle
      // only reduces unnecessary React re-render checks.
      // NOTE: compare on absolute delta. On a track switch / backward seek the
      // clock jumps backward, but this rAF effect does not re-run (its deps
      // [currentTimeValue, isPlaying] are unchanged), so lastNotifiedTime keeps
      // the previous track's large value. A one-directional `>=` check would
      // then suppress every .set() forever, freezing subscribers that rely on
      // "change" events (e.g. ChatVisualizer's per-character reveal).
      if (Math.abs(nextTime - lastNotifiedTime) >= MIN_NOTIFY_DELTA) {
        currentTimeValue.set(nextTime)
        lastNotifiedTime = nextTime
      }
      frameId = window.requestAnimationFrame(advance)
    }

    frameId = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frameId)
  }, [currentTimeValue, isPlaying])

  return currentTimeValue
}