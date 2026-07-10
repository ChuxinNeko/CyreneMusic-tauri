"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { useLyricSettings } from "./LyricSettingsContext"
import { playerService } from "@/lib/services/playerService"
import { LyricLineData, INTRO_DELAY, parseLyrics } from "./parser"

// 圆弧参数：大圆半径，圆心在容器左侧外面
const ARC_ANGLE_PER_LINE = 12 // 每行歌词占据的角度
const VISIBLE_ABOVE = 3
const VISIBLE_BELOW = 3

export const LyricPlayerRoulette = React.memo(function LyricPlayerRoulette({ alignPosition = 'center', disableSeek = false }: { alignPosition?: 'center' | 'top-second'; disableSeek?: boolean }) {
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const { showTranslation, lyricFontSize, lyricFontFamily, hideAlbumCover } = useLyricSettings()
    const containerRef = useRef<HTMLDivElement>(null)
    const requestRef = useRef<number>(0)
    const currentIndexRef = useRef(0)
    const [parsedLyrics, setParsedLyrics] = useState<LyricLineData[]>([])
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        setParsedLyrics(parseLyrics(currentTrack))
    }, [currentTrack?.lyric, currentTrack?.yrc, currentTrack?.tlyric, currentTrack?.ytlrc])

    const getActiveIndex = useCallback((time: number) => {
        let idx = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (time >= parsedLyrics[i].time) {
                idx = i
            }
        }
        return idx
    }, [parsedLyrics])

    useEffect(() => {
        let frameCount = 0
        const FRAME_SKIP = /Mobi|Android/i.test(navigator.userAgent) ? 3 : 1

        const loop = () => {
            frameCount++
            if (frameCount % FRAME_SKIP === 0) {
                const realTime = playerService.getCurrentTime()
                const loopTime = realTime * 1000 + INTRO_DELAY
                const newIndex = getActiveIndex(loopTime)
                if (newIndex !== currentIndexRef.current) {
                    currentIndexRef.current = newIndex
                    setActiveIndex(newIndex)
                }
            }
            requestRef.current = requestAnimationFrame(loop)
        }
        requestRef.current = requestAnimationFrame(loop)
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current) }
    }, [getActiveIndex])

    const handleLineClick = (lineTime: number) => {
        if (disableSeek) return
        const timeInSeconds = (lineTime - INTRO_DELAY) / 1000
        playerService.seek(timeInSeconds)
    }

    // 取可见行
    const getVisibleLines = () => {
        const lines: { line: LyricLineData; index: number; offset: number }[] = []
        for (let offset = -VISIBLE_ABOVE; offset <= VISIBLE_BELOW; offset++) {
            const idx = activeIndex + offset
            if (idx >= 0 && idx < parsedLyrics.length) {
                lines.push({ line: parsedLyrics[idx], index: idx, offset })
            }
        }
        return lines
    }

    const visibleLines = getVisibleLines()

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-visible relative select-none"
        >
            {/* 圆心在容器左侧中间偏外，歌词沿右侧弧线排列 */}
            <div className="absolute inset-0">
                {visibleLines.map(({ line, index, offset }) => {
                    const isActive = offset === 0
                    const absDiff = Math.abs(offset)

                    // offset=0 在3点钟方向(0deg)，offset<0 向2点钟(-角度)，offset>0 向4点钟(+角度)
                    const angle = offset * ARC_ANGLE_PER_LINE
                    const angleRad = (angle * Math.PI) / 180

                    // 圆心在左侧外面，半径大约是容器宽度的 90%
                    // 歌词位置：从圆心出发，3点钟方向为水平向右
                    // 如果隐藏封面（居中模式），我们不使用圆弧，而是简单的垂直滚动
                    const radius = hideAlbumCover ? 0 : 120 // 百分比
                    const centerX = hideAlbumCover ? 50 : -100
                    const centerY = alignPosition === 'top-second' ? 25 : 50

                    const x = centerX + radius * Math.cos(angleRad)
                    const y = centerY + radius * Math.sin(angleRad)

                    const opacity = isActive ? 1 : Math.max(0.2, 0.65 - absDiff * 0.15)
                    const scale = isActive ? 1 : Math.max(0.65, 0.85 - absDiff * 0.06)

                    const transformStyle = hideAlbumCover
                        ? `translate(-50%, calc(-50% + ${offset * 6}vh)) scale(${scale})`
                        : `translateY(-50%) rotate(${angle}deg) scale(${scale})`

                    return (
                        <div
                            key={index}
                            onClick={() => handleLineClick(line.time)}
                            className="absolute cursor-pointer"
                            style={{
                                left: `${x}%`,
                                top: hideAlbumCover ? '50%' : `${y}%`,
                                transform: transformStyle,
                                opacity,
                                transition: "all 1000ms cubic-bezier(0.16, 1, 0.3, 1)",
                                transformOrigin: hideAlbumCover ? "center center" : "left center",
                                maxWidth: hideAlbumCover ? "90%" : "55%",
                                textAlign: hideAlbumCover ? "center" : "left",
                            }}
                        >
                            <div
                                className="font-bold leading-tight whitespace-pre-wrap"
                                style={{
                                    fontFamily: lyricFontFamily,
                                    fontSize: `clamp(${lyricFontSize * 0.7}px, 2.8vw, ${lyricFontSize}px)`,
                                    color: isActive ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.4)",
                                    textShadow: isActive ? "0 0 12px rgba(255,255,255,0.15)" : "none",
                                    transition: "color 600ms ease-out",
                                }}
                            >
                                {line.words.map(w => w.text).join("")}
                            </div>
                            {showTranslation && line.translation && (
                                <div
                                    className="font-medium leading-snug mt-0.5"
                                    style={{
                                        fontFamily: lyricFontFamily,
                                        fontSize: `clamp(${lyricFontSize * 0.35}px, 1.4vw, ${lyricFontSize * 0.55}px)`,
                                        color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                                        transition: "color 600ms ease-out",
                                    }}
                                >
                                    {line.translation}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
})