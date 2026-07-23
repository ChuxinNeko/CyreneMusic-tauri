"use client"

import { useEffect, useRef, useState } from "react"

/**
 * 将高频变化的 currentTime 节流为低频 UI 更新。
 *
 * 移动端 GPU/CPU 资源有限，进度条、时间标签等 UI 元素无需每帧更新，
 * 以 intervalMs 为周期同步一次即可（默认 250ms ≈ 4fps），大幅减少
 * React 重渲染次数，同时不影响歌词/动画等使用 MotionValue 的高频管线。
 *
 * @param currentTime 来自 store 的高频 currentTime
 * @param intervalMs  节流间隔（毫秒），默认 250
 */
export function useThrottledTime(currentTime: number, intervalMs = 250): number {
  const [throttled, setThrottled] = useState(currentTime)
  const lastUpdateRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const now = performance.now()
    if (now - lastUpdateRef.current >= intervalMs) {
      lastUpdateRef.current = now
      setThrottled(currentTime)
    } else {
      // 延迟到下一个节流窗口再更新，保证最终值不丢失
      cancelAnimationFrame(rafRef.current)
      const remaining = intervalMs - (now - lastUpdateRef.current)
      const timeoutId = setTimeout(() => {
        lastUpdateRef.current = performance.now()
        setThrottled(currentTime)
      }, remaining)
      return () => clearTimeout(timeoutId)
    }
  }, [currentTime, intervalMs])

  return throttled
}