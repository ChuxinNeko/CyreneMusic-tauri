"use client"

import React, { useState, useCallback } from "react"
import { cn } from "@/lib/utils"

/**
 * 玻璃拟态播放进度条（SuperCyrene 统一样式）
 *
 * 结构：左时间标签 · 轨道(bg-white/15) + 填充(bg-white/75) + 透明 range 交互 · 右时间标签。
 * 无可见滑块圆点，纯轨道+填充。scrub 状态内聚在组件内部，
 * 底部胶囊与左下角控制面板复用同一实现，保证样式与交互完全一致。
 *
 * 性能优化：React.memo 包裹 + 移除冗余 useEffect 同步，
 * 仅在 props 实际变化时重渲染。
 */

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, "0")}`
}

const clampTime = (time: number, duration: number): number =>
  duration > 0 ? Math.min(duration, Math.max(0, time)) : 0

interface GlassProgressBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  /** 是否显示两侧时间标签（折叠态胶囊传 false，仅保留可访问性） */
  showLabels?: boolean
  /** 外层 flex 容器附加类（用于 padding / gap 微调） */
  className?: string
  /** 时间标签附加类（字号 / 颜色差异由调用方传入） */
  labelClassName?: string
}

export const GlassProgressBar = React.memo(function GlassProgressBar({
  currentTime,
  duration,
  onSeek,
  showLabels = true,
  className,
  labelClassName,
}: GlassProgressBarProps) {
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)

  // 非 scrub 时直接用 currentTime，无需额外 state 同步（消除冗余 useEffect 重渲染）
  const displayedTime = isScrubbing ? scrubTime : currentTime
  const progress = duration > 0 ? (clampTime(displayedTime, duration) / duration) * 100 : 0

  const handleSeekStart = useCallback((event: React.PointerEvent<HTMLInputElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsScrubbing(true)
    setScrubTime(clampTime(Number(event.currentTarget.value), duration))
  }, [duration])

  const handleSeekEnd = useCallback((event: React.PointerEvent<HTMLInputElement>) => {
    const nextTime = clampTime(Number(event.currentTarget.value), duration)
    setIsScrubbing(false)
    onSeek(nextTime)
  }, [duration, onSeek])

  const handleInput = useCallback((event: React.FormEvent<HTMLInputElement>) => {
    setScrubTime(clampTime(Number(event.currentTarget.value), duration))
  }, [duration])

  const handlePointerCancel = useCallback(() => {
    setIsScrubbing(false)
  }, [])

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className={showLabels ? cn("w-8 text-right font-mono tabular-nums", labelClassName) : "sr-only"}>
        {formatTime(displayedTime)}
      </span>
      <div className="group relative h-1.5 flex-1 rounded-full bg-white/15">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white/75 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
        <input
          aria-label="播放进度"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={clampTime(displayedTime, duration)}
          onPointerDown={handleSeekStart}
          onInput={handleInput}
          onPointerUp={handleSeekEnd}
          onPointerCancel={handlePointerCancel}
          onChange={() => undefined}
          className="absolute -inset-y-3 inset-x-0 h-7 w-full cursor-pointer opacity-0"
        />
      </div>
      <span className={showLabels ? cn("w-8 font-mono tabular-nums", labelClassName) : "sr-only"}>
        {formatTime(duration)}
      </span>
    </div>
  )
})