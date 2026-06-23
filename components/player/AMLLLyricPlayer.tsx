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
    const lyricBlurStrength = usePlayerStore(s => s.lyricBlurStrength)

    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<AmllLyricPlayer | null>(null)
    const rafRef = useRef<number>(0)
    const lastFrameTimeRef = useRef<number>(-1)

    // 初始化 AMLL 播放器实例
    useEffect(() => {
        if (!containerRef.current) return

        const player = new AmllLyricPlayer()
        player.setEnableSpring(true)
        player.setEnableScale(true)
        player.setEnableBlur(true)
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

    // 歌词数据加载：始终包含翻译数据，通过 DOM 控制可见性
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        const parsed = parseLyrics(currentTrack)
        if (parsed.length === 0) {
            player.setLyricLines([], 0)
            return
        }

        const amllLines = toAmllLyricLines(parsed, true)
        const currentTime = Math.round(playerService.getCurrentTime() * 1000) + INTRO_DELAY
        player.setLyricLines(amllLines, currentTime)
        player.setCurrentTime(currentTime, true)

        // 歌词加载后同步翻译行可见性
        const display = showTranslation ? "" : "none"
        player.getElement().querySelectorAll('.FmKaba_lyricSubLine')
            .forEach(node => (node as HTMLElement).style.display = display)
    }, [currentTrack?.lyric, currentTrack?.yrc, currentTrack?.tlyric, currentTrack?.ytlrc])

    // 翻译显示切换：直接操作 DOM 隐藏/显示翻译行，避免重建歌词
    useEffect(() => {
        const player = playerRef.current
        if (!player) return
        const el = player.getElement()
        const display = showTranslation ? "" : "none"
        el.querySelectorAll('.FmKaba_lyricSubLine')
            .forEach(node => (node as HTMLElement).style.display = display)
    }, [showTranslation])

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

    // 模糊强度
    useEffect(() => {
        const player = playerRef.current
        if (!player) return
        player.setEnableBlur(lyricBlurStrength > 0)
    }, [lyricBlurStrength])

    // 逐帧更新循环：同步播放进度 + 驱动 AMLL 动画
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        if (!isPlaying) {
            player.pause()
            return
        }

        player.resume()
        lastFrameTimeRef.current = -1

        const tick = (timestamp: number) => {
            const delta = lastFrameTimeRef.current < 0 ? 0 : timestamp - lastFrameTimeRef.current
            lastFrameTimeRef.current = timestamp

            const timeMs = Math.round(playerService.getCurrentTime() * 1000) + INTRO_DELAY
            player.setCurrentTime(timeMs)
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