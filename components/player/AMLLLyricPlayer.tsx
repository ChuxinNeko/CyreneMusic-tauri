"use client"

import React, { useEffect, useRef } from "react"
import { LyricPlayer as AmllLyricPlayer } from "@applemusic-like-lyrics/core"
import type { LyricLineMouseEvent } from "@applemusic-like-lyrics/core"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { INTRO_DELAY, parseLyrics, toAmllLyricLines } from "./parser"

import "@applemusic-like-lyrics/core/style.css"

export const AMLLLyricPlayer = React.memo(function AMLLLyricPlayer() {
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const showTranslation = usePlayerStore(s => s.showTranslation)
    const lyricFontSize = usePlayerStore(s => s.lyricFontSize)
    const lyricFontFamily = usePlayerStore(s => s.lyricFontFamily)

    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<AmllLyricPlayer | null>(null)
    const rafRef = useRef<number>(0)
    const lastFrameTimeRef = useRef<number>(-1)
    const lastTimeMsRef = useRef<number>(-1)

    // 初始化 AMLL 播放器实例
    useEffect(() => {
        if (!containerRef.current) return

        const player = new AmllLyricPlayer()
        player.setEnableSpring(true)
        player.setEnableScale(true)
        player.setEnableBlur(false)
        player.setAlignPosition(0.15)
        player.setWordFadeWidth(1.0)

        containerRef.current.appendChild(player.getElement())
        playerRef.current = player

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            player.dispose()
            playerRef.current = null
        }
    }, [])

    // 歌词数据加载：翻译数据按需传入，避免创建无用 DOM 元素
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        const parsed = parseLyrics(currentTrack)
        if (parsed.length === 0) {
            player.setLyricLines([], 0)
            return
        }

        const amllLines = toAmllLyricLines(parsed, showTranslation)
        const currentTime = Math.round(playerService.getCurrentTime() * 1000) + INTRO_DELAY
        player.setLyricLines(amllLines, currentTime)
        player.setCurrentTime(currentTime, true)
    }, [currentTrack?.lyric, currentTrack?.yrc, currentTrack?.tlyric, currentTrack?.ytlrc, showTranslation])

    // 字号自定义
    useEffect(() => {
        const player = playerRef.current
        if (!player) return
        const el = player.getElement()
        el.style.setProperty("--amll-lp-font-size", `${lyricFontSize}px`)
    }, [lyricFontSize])

    // 字体自定义
    useEffect(() => {
        const player = playerRef.current
        if (!player) return
        player.getElement().style.fontFamily = lyricFontFamily
    }, [lyricFontFamily])


    // 逐帧更新循环：同步播放进度 + 驱动 AMLL 动画
    // 核心优化：setCurrentTime 内部会触发布局重算（遍历歌词组 + DOM reflow），
    // 将其限制为每 100ms 一次；轻量的 update(delta) 弹簧动画保持每帧执行。
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        if (!isPlaying) {
            player.pause()
            return
        }

        player.resume()
        lastFrameTimeRef.current = -1
        lastTimeMsRef.current = -1

        let elapsed = 100 // 首帧立即触发一次 setCurrentTime

        const tick = (timestamp: number) => {
            const delta = lastFrameTimeRef.current < 0 ? 0 : timestamp - lastFrameTimeRef.current
            lastFrameTimeRef.current = timestamp

            elapsed += delta

            if (elapsed >= 100) {
                elapsed = 0
                const timeMs = Math.round(playerService.getCurrentTime() * 1000) + INTRO_DELAY
                if (timeMs !== lastTimeMsRef.current) {
                    lastTimeMsRef.current = timeMs
                    player.setCurrentTime(timeMs)
                }
            }

            player.update(delta)

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [isPlaying])

    // 点击歌词行跳转
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        const handleClick = (evt: Event) => {
            const e = evt as LyricLineMouseEvent
            const line = e.line
            if (!line) return
            const lineData = line.getLine()
            if (!lineData) return
            const timeInSeconds = (lineData.startTime - INTRO_DELAY) / 1000
            if (timeInSeconds >= 0) {
                playerService.seek(timeInSeconds)
            }
        }

        player.addEventListener("line-click", handleClick)
        return () => {
            player.removeEventListener("line-click", handleClick)
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden"
            style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, white 12%, white 82%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, white 12%, white 82%, transparent 100%)",
            }}
        />
    )
})