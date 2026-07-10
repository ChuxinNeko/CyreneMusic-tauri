"use client"

import React, { createContext, useContext, useMemo } from "react"
import { LyricDisplayStyle, SingleLineAnimation } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { useDesktopPlayerStore } from "@/lib/store/useDesktopPlayerStore"

/**
 * 歌词设置作用域
 *
 * 歌词组件（AMLLLyricPlayer / LyricPlayerSingleLine / LyricPlayerRoulette / LyricPlayer）
 * 不再直接硬编码 store，而是通过 context 选择当前作用域的 store。
 *
 * - "fullscreen"：全屏播放器 → useFullscreenSettingsStore（独立持久化 key）
 * - "desktop"：桌面播放器   → useDesktopPlayerStore（独立持久化 key）
 *
 * 通过 <LyricSettingsProvider scope="desktop"> 包裹歌词组件树即可切换数据源。
 */

export type LyricScope = "fullscreen" | "desktop"

// ── 统一的歌词设置接口 ──
export interface LyricSettings {
    lyricFontSize: number
    lyricFontFamily: string
    lyricBlurStrength: number
    lyricDisplayStyle: LyricDisplayStyle
    singleLineAnimation: SingleLineAnimation
    hideAlbumCover: boolean
    showTranslation: boolean
    audioVisualization: boolean
    isImmersiveMode: boolean

    // setters
    setLyricFontSize: (v: number) => void
    setLyricFontFamily: (v: string) => void
    setLyricBlurStrength: (v: number) => void
    setLyricDisplayStyle: (v: LyricDisplayStyle) => void
    setSingleLineAnimation: (v: SingleLineAnimation) => void
    setHideAlbumCover: (v: boolean) => void
    setShowTranslation: (v: boolean) => void
    toggleTranslation: () => void
    toggleAudioVisualization: () => void
    setIsImmersiveMode: (v: boolean) => void
}

// ── 从全屏播放器设置 store 构造 settings 对象 ──
function useFullscreenLyricSettings(): LyricSettings {
    const s = useFullscreenSettingsStore()

    return useMemo(() => ({
        lyricFontSize: s.lyricFontSize,
        lyricFontFamily: s.lyricFontFamily,
        lyricBlurStrength: s.lyricBlurStrength,
        lyricDisplayStyle: s.lyricDisplayStyle,
        singleLineAnimation: s.singleLineAnimation,
        hideAlbumCover: s.hideAlbumCover,
        showTranslation: s.showTranslation,
        audioVisualization: s.audioVisualization,
        isImmersiveMode: s.isImmersiveMode,
        setLyricFontSize: s.setLyricFontSize,
        setLyricFontFamily: s.setLyricFontFamily,
        setLyricBlurStrength: s.setLyricBlurStrength,
        setLyricDisplayStyle: s.setLyricDisplayStyle,
        setSingleLineAnimation: s.setSingleLineAnimation,
        setHideAlbumCover: s.setHideAlbumCover,
        setShowTranslation: s.toggleTranslation,
        toggleTranslation: s.toggleTranslation,
        toggleAudioVisualization: s.toggleAudioVisualization,
        setIsImmersiveMode: s.setIsImmersiveMode,
    }), [s])
}

// ── 从桌面播放器 store 构造 settings 对象 ──
function useDesktopLyricSettings(): LyricSettings {
    const s = useDesktopPlayerStore()

    return useMemo(() => ({
        lyricFontSize: s.lyricFontSize,
        lyricFontFamily: s.lyricFontFamily,
        lyricBlurStrength: s.lyricBlurStrength,
        lyricDisplayStyle: s.lyricDisplayStyle,
        singleLineAnimation: s.singleLineAnimation,
        hideAlbumCover: s.hideAlbumCover,
        showTranslation: s.showTranslation,
        audioVisualization: s.audioVisualization,
        isImmersiveMode: s.isImmersiveMode,
        setLyricFontSize: s.setLyricFontSize,
        setLyricFontFamily: s.setLyricFontFamily,
        setLyricBlurStrength: s.setLyricBlurStrength,
        setLyricDisplayStyle: s.setLyricDisplayStyle,
        setSingleLineAnimation: s.setSingleLineAnimation,
        setHideAlbumCover: s.setHideAlbumCover,
        setShowTranslation: s.setShowTranslation,
        toggleTranslation: s.toggleTranslation,
        toggleAudioVisualization: s.toggleAudioVisualization,
        setIsImmersiveMode: s.setIsImmersiveMode,
    }), [s])
}

const LyricSettingsContext = createContext<LyricSettings | null>(null)

export function LyricSettingsProvider({
    scope,
    children,
}: {
    scope: LyricScope
    children: React.ReactNode
}) {
    const fullscreenSettings = useFullscreenLyricSettings()
    const desktopSettings = useDesktopLyricSettings()
    const value = scope === "desktop" ? desktopSettings : fullscreenSettings

    return (
        <LyricSettingsContext.Provider value={value}>
            {children}
        </LyricSettingsContext.Provider>
    )
}

export function useLyricSettings(): LyricSettings {
    const ctx = useContext(LyricSettingsContext)
    if (!ctx) {
        throw new Error("useLyricSettings 必须在 <LyricSettingsProvider> 内使用")
    }
    return ctx
}