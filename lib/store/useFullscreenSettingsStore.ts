import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LyricDisplayStyle, SingleLineAnimation, PlayerBgType } from './usePlayerStore'
import { DEFAULT_LYRIC_FONT } from '../constants/fonts'

/**
 * 全屏播放器独立显示设置 Store
 *
 * 从 usePlayerStore 迁移而来，解决多窗口（桌面播放器 / 桌面小组件 / 桌面歌词）
 * 共享 usePlayerStore → player-storage 导致设置互相覆盖的问题。
 *
 * 持久化 key: "fullscreen-settings-storage"
 */
export interface FullscreenSettingsState {
    lyricFontSize: number
    lyricFontFamily: string
    lyricBlurStrength: number
    desktopLyricFontSize: number
    desktopLyricColor: string
    desktopLyricStrokeColor: string
    isLyricsFolded: boolean
    isImmersiveMode: boolean
    lyricDisplayStyle: LyricDisplayStyle
    singleLineAnimation: SingleLineAnimation
    hideAlbumCover: boolean
    showTranslation: boolean
    audioVisualization: boolean

    playerBgType: PlayerBgType
    customBgPath: string | null
    customBgBlur: number
    customBgBrightness: number
    customBgScale: number
    customBgOverlay: number

    setLyricFontSize: (size: number) => void
    setLyricFontFamily: (font: string) => void
    setLyricBlurStrength: (strength: number) => void
    setDesktopLyricFontSize: (size: number) => void
    setDesktopLyricColor: (color: string) => void
    setDesktopLyricStrokeColor: (color: string) => void
    setIsLyricsFolded: (folded: boolean) => void
    setIsImmersiveMode: (isImmersiveMode: boolean) => void
    setLyricDisplayStyle: (style: LyricDisplayStyle) => void
    setSingleLineAnimation: (animation: SingleLineAnimation) => void
    setHideAlbumCover: (hide: boolean) => void
    toggleTranslation: () => void
    toggleAudioVisualization: () => void

    setPlayerBgType: (type: PlayerBgType) => void
    setCustomBgPath: (path: string | null) => void
    setCustomBgBlur: (blur: number) => void
    setCustomBgBrightness: (brightness: number) => void
    setCustomBgScale: (scale: number) => void
    setCustomBgOverlay: (overlay: number) => void
}

export const useFullscreenSettingsStore = create<FullscreenSettingsState>()(
    persist(
        (set) => ({
            lyricFontSize: 34,
            lyricFontFamily: DEFAULT_LYRIC_FONT,
            lyricBlurStrength: 6,
            desktopLyricFontSize: 40,
            desktopLyricColor: '#ffffff',
            desktopLyricStrokeColor: '#bababa',
            isLyricsFolded: false,
            isImmersiveMode: false,
            lyricDisplayStyle: LyricDisplayStyle.Scroll,
            singleLineAnimation: SingleLineAnimation.SlideUp,
            hideAlbumCover: false,
            showTranslation: true,
            audioVisualization: true,

            playerBgType: 'webgl',
            customBgPath: null,
            customBgBlur: 0,
            customBgBrightness: 60,
            customBgScale: 110,
            customBgOverlay: 30,

            setLyricFontSize: (lyricFontSize) => set({ lyricFontSize }),
            setLyricFontFamily: (lyricFontFamily) => set({ lyricFontFamily }),
            setLyricBlurStrength: (lyricBlurStrength) => set({ lyricBlurStrength }),
            setDesktopLyricFontSize: (desktopLyricFontSize) => set({ desktopLyricFontSize }),
            setDesktopLyricColor: (desktopLyricColor) => set({ desktopLyricColor }),
            setDesktopLyricStrokeColor: (desktopLyricStrokeColor) => set({ desktopLyricStrokeColor }),
            setIsLyricsFolded: (isLyricsFolded) => set({ isLyricsFolded }),
            setIsImmersiveMode: (isImmersiveMode) => set({ isImmersiveMode }),
            setLyricDisplayStyle: (lyricDisplayStyle) => set({ lyricDisplayStyle }),
            setSingleLineAnimation: (singleLineAnimation) => set({ singleLineAnimation }),
            setHideAlbumCover: (hideAlbumCover) => set({ hideAlbumCover }),
            toggleTranslation: () => set((state) => ({ showTranslation: !state.showTranslation })),
            toggleAudioVisualization: () => set((state) => ({ audioVisualization: !state.audioVisualization })),

            setPlayerBgType: (type) => set({ playerBgType: type }),
            setCustomBgPath: (customBgPath) => set({ customBgPath }),
            setCustomBgBlur: (customBgBlur) => set({ customBgBlur }),
            setCustomBgBrightness: (customBgBrightness) => set({ customBgBrightness }),
            setCustomBgScale: (customBgScale) => set({ customBgScale }),
            setCustomBgOverlay: (customBgOverlay) => set({ customBgOverlay }),
        }),
        {
            name: 'fullscreen-settings-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)