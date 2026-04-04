"use client"

import React from "react"
import { audioAnalyser } from "@/lib/services/audioAnalyser"
import { LiquidGlass } from "@/components/ui/LiquidGlass"

interface AudioVisualizerProps {
    /** 从封面提取的主题色数组 */
    colors: string[]
    /** 是否紧凑模式（沉浸模式下使用） */
    compact?: boolean
    /** 是否正在播放 */
    isPlaying?: boolean
    className?: string
}

const BAR_COUNT = 6

export function AudioVisualizer({
    colors,
    compact = false,
    isPlaying = false,
    className = "",
}: AudioVisualizerProps) {
    const barsRef = React.useRef<(HTMLDivElement | null)[]>([])
    const rafRef = React.useRef<number>(0)
    // 用于暂停后归零的动画插值
    const displayValues = React.useRef<number[]>(new Array(BAR_COUNT).fill(0))

    React.useEffect(() => {
        const update = () => {
            let targets: number[]

            if (isPlaying) {
                targets = audioAnalyser.getBarData(BAR_COUNT)
            } else {
                // 暂停时目标值为零
                targets = new Array(BAR_COUNT).fill(0)
            }

            // 平滑插值——上升快、下降慢，保持视觉余韵
            for (let i = 0; i < BAR_COUNT; i++) {
                const current = displayValues.current[i]
                const target = targets[i]
                const factor = target > current ? 0.4 : 0.12
                displayValues.current[i] = current + (target - current) * factor
            }

            // 直接操作 DOM，避免 React re-render
            for (let i = 0; i < BAR_COUNT; i++) {
                const bar = barsRef.current[i]
                if (!bar) continue

                const value = displayValues.current[i]
                const maxHeight = compact ? 18 : 22
                const minHeight = compact ? 3 : 4
                const height = minHeight + value * (maxHeight - minHeight)

                bar.style.height = `${height}px`
                // 添加微妙的发光效果随能量变化
                bar.style.opacity = `${0.6 + value * 0.4}`
            }

            rafRef.current = requestAnimationFrame(update)
        }

        rafRef.current = requestAnimationFrame(update)

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = 0
            }
        }
    }, [isPlaying, compact])



    const bars = (
        <div
            className="flex items-end justify-center mix-blend-overlay"
            style={{ gap: compact ? '3px' : '5px' }}
        >
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <div
                    key={i}
                    ref={(el) => { barsRef.current[i] = el }}
                    style={{
                        width: compact ? '3px' : '4px',
                        height: compact ? '3px' : '4px',
                        borderRadius: '2px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        transition: 'none',
                        willChange: 'height, opacity',
                        boxShadow: '0 0 6px rgba(255, 255, 255, 0.4)',
                    }}
                />
            ))}
        </div>
    )

    if (compact) {
        // 沉浸模式：直接渲染竖条，无胶囊容器
        return (
            <div className={`flex items-center ${className}`}>
                {bars}
            </div>
        )
    }

    // 非沉浸模式：胶囊容器 + LiquidGlass
    return (
        <div
            className={`relative flex items-center justify-center border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] rounded-full overflow-hidden ${className}`}
            style={{
                width: '120px',
                height: '32px',
            }}
        >
            <LiquidGlass className="bg-white/10" />
            <div className="relative z-10">
                {bars}
            </div>
        </div>
    )
}
