import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Track } from '../models/track'

export enum RepeatMode {
    Off = 'off',
    All = 'all',
    One = 'one',
    Shuffle = 'shuffle'
}

export enum LyricDisplayStyle {
    Scroll = 'scroll',
    Roulette = 'roulette',
    SingleLine = 'singleLine',
}

export enum SingleLineAnimation {
    SlideUp = 'slideUp',
    Fade = 'fade',
    Zoom = 'zoom',
    Blur = 'blur'
}

interface PlayerState {
    // Current track being played
    currentTrack: Track | null
    // Current playback queue
    queue: Track[]
    // Playback history
    history: Track[]
    // Playback status
    isPlaying: boolean
    isLoading: boolean
    // Playback progress (0.0 to 1.0)
    progress: number
    // Current playback time in seconds
    currentTime: number
    // Total duration in seconds
    duration: number
    // Volume (0.0 to 1.0)
    volume: number
    // Repeat mode
    repeatMode: RepeatMode
    // Fullscreen state
    isFullscreen: boolean
    // Show lyric translation
    showTranslation: boolean
    // Audio visualization (rhythm response)
    audioVisualization: boolean
    // Lyric Appearance
    lyricFontSize: number
    lyricBlurStrength: number

    // Desktop Lyric Appearance
    desktopLyricFontSize: number
    desktopLyricColor: string
    desktopLyricStrokeColor: string
    isLyricsFolded: boolean
    isImmersiveMode: boolean
    lyricDisplayStyle: LyricDisplayStyle
    singleLineAnimation: SingleLineAnimation
    playError: string | null
    isTaskbarPlayerOpen: boolean

    // Actions
    setCurrentTrack: (track: Track | null, preserveProgress?: boolean) => void
    updateTrackLyrics: (lyrics: Partial<Pick<Track, 'lyric' | 'yrc' | 'tlyric' | 'ytlrc' | 'chorus'>>) => void
    setQueue: (tracks: Track[]) => void
    addToQueue: (track: Track) => void
    removeFromQueue: (trackId: string | number) => void
    clearQueue: () => void

    setIsPlaying: (isPlaying: boolean) => void
    setIsLoading: (isLoading: boolean) => void
    setProgress: (progress: number) => void
    setCurrentTime: (time: number) => void
    setDuration: (duration: number) => void
    setVolume: (volume: number) => void
    setRepeatMode: (mode: RepeatMode) => void
    setIsFullscreen: (value: boolean) => void
    toggleTranslation: () => void
    toggleAudioVisualization: () => void
    setLyricFontSize: (size: number) => void
    setLyricBlurStrength: (strength: number) => void

    setDesktopLyricFontSize: (size: number) => void
    setDesktopLyricColor: (color: string) => void
    setDesktopLyricStrokeColor: (color: string) => void
    setIsLyricsFolded: (folded: boolean) => void
    setIsImmersiveMode: (isImmersiveMode: boolean) => void
    setLyricDisplayStyle: (style: LyricDisplayStyle) => void
    setSingleLineAnimation: (animation: SingleLineAnimation) => void
    setPlayError: (error: string | null) => void
    setIsTaskbarPlayerOpen: (open: boolean) => void

    playNext: () => void
    playPrevious: () => void
}

export const usePlayerStore = create<PlayerState>()(
    persist(
        (set, get) => ({
            currentTrack: null,
            queue: [],
            history: [],
            isPlaying: false,
            isLoading: false,
            progress: 0,
            currentTime: 0,
            duration: 0,
            volume: 0.8,
            repeatMode: RepeatMode.All,
            isFullscreen: false,
            showTranslation: true,
            audioVisualization: true,
            lyricFontSize: 34,
            lyricBlurStrength: 6,
            desktopLyricFontSize: 40,
            desktopLyricColor: '#ffffff',
            desktopLyricStrokeColor: '#bababa',
            isLyricsFolded: false,
            isImmersiveMode: false,
            lyricDisplayStyle: LyricDisplayStyle.Scroll,
            singleLineAnimation: SingleLineAnimation.SlideUp,
            playError: null,
            isTaskbarPlayerOpen: true,

            setCurrentTrack: (track, preserveProgress = false) => {
                const { currentTrack, history } = get()

                // 状态快照更新
                const updates: Partial<PlayerState> = {
                    currentTrack: track,
                    isPlaying: !!track,
                    isLoading: !!track,
                    playError: null
                }
                
                if (!preserveProgress) {
                    updates.progress = 0
                    updates.currentTime = 0
                }
                
                set(updates)

                if (track) {
                    const isSameTrack = currentTrack?.id === track.id && currentTrack?.source === track.source
                    if (!isSameTrack) {
                        const newHistory = [track, ...history.filter(t => t.id !== track.id || t.source !== track.source)].slice(0, 100)
                        set({ history: newHistory })
                    }
                }
            },

            updateTrackLyrics: (lyrics) => {
                const { currentTrack } = get()
                if (!currentTrack) return
                set({ currentTrack: { ...currentTrack, ...lyrics } })
            },

            setQueue: (tracks) => set({ queue: tracks }),

            addToQueue: (track) => {
                const { queue } = get()
                const exists = queue.some(t => t.id === track.id && t.source === track.source)
                if (!exists) {
                    set({ queue: [...queue, track] })
                }
            },

            removeFromQueue: (trackId) => {
                const { queue } = get()
                set({ queue: queue.filter(t => t.id !== trackId) })
            },

            clearQueue: () => set({ queue: [], currentTrack: null, isPlaying: false }),

            setIsPlaying: (isPlaying) => set({ isPlaying }),
            setIsLoading: (isLoading) => set({ isLoading }),
            setProgress: (progress) => set({ progress }),
            setCurrentTime: (currentTime) => set({ currentTime }),
            setDuration: (duration) => set({ duration }),
            setVolume: (volume) => set({ volume }),
            setRepeatMode: (repeatMode) => set({ repeatMode }),
            setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
            toggleTranslation: () => set((state) => ({ showTranslation: !state.showTranslation })),
            toggleAudioVisualization: () => set((state) => ({ audioVisualization: !state.audioVisualization })),
            setLyricFontSize: (size) => set({ lyricFontSize: size }),
            setLyricBlurStrength: (strength) => set({ lyricBlurStrength: strength }),
            setDesktopLyricFontSize: (desktopLyricFontSize) => set({ desktopLyricFontSize }),
            setDesktopLyricColor: (desktopLyricColor) => set({ desktopLyricColor }),
            setDesktopLyricStrokeColor: (desktopLyricStrokeColor) => set({ desktopLyricStrokeColor }),
            setIsLyricsFolded: (isLyricsFolded) => set({ isLyricsFolded }),
            setIsImmersiveMode: (isImmersiveMode) => set({ isImmersiveMode }),
            setLyricDisplayStyle: (lyricDisplayStyle) => set({ lyricDisplayStyle }),
            setSingleLineAnimation: (singleLineAnimation) => set({ singleLineAnimation }),
            setPlayError: (playError) => set({ playError }),
            setIsTaskbarPlayerOpen: (isTaskbarPlayerOpen) => set({ isTaskbarPlayerOpen }),

            playNext: () => {
                const { queue, currentTrack, repeatMode } = get()
                if (queue.length === 0) return

                let nextIndex = 0
                if (currentTrack) {
                    const currentIndex = queue.findIndex(t => t.id === currentTrack.id && t.source === currentTrack.source)
                    if (repeatMode === RepeatMode.Shuffle) {
                        nextIndex = Math.floor(Math.random() * queue.length)
                    } else {
                        nextIndex = (currentIndex + 1) % queue.length
                    }
                }
                set({ currentTrack: queue[nextIndex], isPlaying: true, progress: 0, currentTime: 0 })
            },

            playPrevious: () => {
                const { queue, currentTrack } = get()
                if (queue.length === 0) return

                let prevIndex = 0
                if (currentTrack) {
                    const currentIndex = queue.findIndex(t => t.id === currentTrack.id && t.source === currentTrack.source)
                    prevIndex = (currentIndex - 1 + queue.length) % queue.length
                }
                set({ currentTrack: queue[prevIndex], isPlaying: true, progress: 0, currentTime: 0 })
            }
        }),
        {
            name: 'player-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                queue: state.queue,
                currentTrack: state.currentTrack,
                volume: state.volume,
                repeatMode: state.repeatMode,
                history: state.history,
                currentTime: state.currentTime,
                duration: state.duration,
                progress: state.progress,
                audioVisualization: state.audioVisualization,
                lyricFontSize: state.lyricFontSize,
                lyricBlurStrength: state.lyricBlurStrength,
                desktopLyricFontSize: state.desktopLyricFontSize,
                desktopLyricColor: state.desktopLyricColor,
                desktopLyricStrokeColor: state.desktopLyricStrokeColor,
                isLyricsFolded: state.isLyricsFolded,
                isImmersiveMode: state.isImmersiveMode,
                lyricDisplayStyle: state.lyricDisplayStyle,
                singleLineAnimation: state.singleLineAnimation,
                isTaskbarPlayerOpen: state.isTaskbarPlayerOpen,
            }),
        }
    )
)
