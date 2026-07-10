import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LyricDisplayStyle, SingleLineAnimation } from './usePlayerStore'
import { DEFAULT_LYRIC_FONT } from '../constants/fonts'

/**
 * 桌面播放器独立设置 Store
 *
 * 与 usePlayerStore 中的全屏播放器设置完全独立：
 * - 歌词字号 / 字体 / 模糊 / 样式 / 单行动画
 * - 隐藏封面 / 显示翻译 / 音频律动 / 沉浸模式
 * - 编辑模式 + 偏移量（桌面播放器专有，从 usePlayerStore 迁移）
 * - 3D 旋转效果（桌面播放器专有，从 usePlayerStore 迁移）
 *
 * 持久化 key: "desktop-player-storage"
 */
export interface DesktopPlayerState {
    // ── 歌词视觉（与全屏播放器独立） ──
    lyricFontSize: number
    lyricFontFamily: string
    lyricBlurStrength: number
    lyricDisplayStyle: LyricDisplayStyle
    singleLineAnimation: SingleLineAnimation
    hideAlbumCover: boolean
    showTranslation: boolean
    audioVisualization: boolean
    isImmersiveMode: boolean

    // ── 编辑模式（桌面播放器专有，从 usePlayerStore 迁移） ──
    isLyricEditorMode: boolean
    lyricOffsetX: number
    lyricOffsetY: number

    // ── 3D 效果（桌面播放器专有，从 usePlayerStore 迁移） ──
    desktopLyricRotationX: number
    desktopLyricRotationY: number
    desktopLyricRotationZ: number
    desktopLyricPerspective: number

    // ── Actions ──
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

    setIsLyricEditorMode: (v: boolean) => void
    setLyricOffsetX: (v: number) => void
    setLyricOffsetY: (v: number) => void

    setDesktopLyricRotationX: (v: number) => void
    setDesktopLyricRotationY: (v: number) => void
    setDesktopLyricRotationZ: (v: number) => void
    setDesktopLyricPerspective: (v: number) => void
}

export const useDesktopPlayerStore = create<DesktopPlayerState>()(
    persist(
        (set) => ({
            // 默认值与 usePlayerStore 中全屏播放器保持一致，
            // 用户可各自独立调整
            lyricFontSize: 34,
            lyricFontFamily: DEFAULT_LYRIC_FONT,
            lyricBlurStrength: 6,
            lyricDisplayStyle: LyricDisplayStyle.Scroll,
            singleLineAnimation: SingleLineAnimation.SlideUp,
            hideAlbumCover: false,
            showTranslation: true,
            audioVisualization: true,
            isImmersiveMode: false,

            isLyricEditorMode: false,
            lyricOffsetX: 0,
            lyricOffsetY: 0,

            desktopLyricRotationX: 0,
            desktopLyricRotationY: 0,
            desktopLyricRotationZ: 0,
            desktopLyricPerspective: 1000,

            setLyricFontSize: (v) => set({ lyricFontSize: v }),
            setLyricFontFamily: (v) => set({ lyricFontFamily: v }),
            setLyricBlurStrength: (v) => set({ lyricBlurStrength: v }),
            setLyricDisplayStyle: (v) => set({ lyricDisplayStyle: v }),
            setSingleLineAnimation: (v) => set({ singleLineAnimation: v }),
            setHideAlbumCover: (v) => set({ hideAlbumCover: v }),
            setShowTranslation: (v) => set({ showTranslation: v }),
            toggleTranslation: () => set((s) => ({ showTranslation: !s.showTranslation })),
            toggleAudioVisualization: () => set((s) => ({ audioVisualization: !s.audioVisualization })),
            setIsImmersiveMode: (v) => set({ isImmersiveMode: v }),

            setIsLyricEditorMode: (v) => set({ isLyricEditorMode: v }),
            setLyricOffsetX: (v) => set({ lyricOffsetX: v }),
            setLyricOffsetY: (v) => set({ lyricOffsetY: v }),

            setDesktopLyricRotationX: (v) => set({ desktopLyricRotationX: v }),
            setDesktopLyricRotationY: (v) => set({ desktopLyricRotationY: v }),
            setDesktopLyricRotationZ: (v) => set({ desktopLyricRotationZ: v }),
            setDesktopLyricPerspective: (v) => set({ desktopLyricPerspective: v }),
        }),
        {
            name: 'desktop-player-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                lyricFontSize: state.lyricFontSize,
                lyricFontFamily: state.lyricFontFamily,
                lyricBlurStrength: state.lyricBlurStrength,
                lyricDisplayStyle: state.lyricDisplayStyle,
                singleLineAnimation: state.singleLineAnimation,
                hideAlbumCover: state.hideAlbumCover,
                showTranslation: state.showTranslation,
                audioVisualization: state.audioVisualization,
                isImmersiveMode: state.isImmersiveMode,
                isLyricEditorMode: state.isLyricEditorMode,
                lyricOffsetX: state.lyricOffsetX,
                lyricOffsetY: state.lyricOffsetY,
                desktopLyricRotationX: state.desktopLyricRotationX,
                desktopLyricRotationY: state.desktopLyricRotationY,
                desktopLyricRotationZ: state.desktopLyricRotationZ,
                desktopLyricPerspective: state.desktopLyricPerspective,
            }),
        }
    )
)