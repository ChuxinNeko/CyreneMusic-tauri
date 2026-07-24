import { usePlayerStore } from '../store/usePlayerStore'
import { parseLyrics } from '../../components/player/parser/lyricParser'
import { invoke } from '@tauri-apps/api/core'
import { isAndroidTauriRuntime } from '../utils/platform'
import { LyricLineData } from '../../components/player/parser/types'

class AndroidLyricService {
    private static instance: AndroidLyricService
    private lastSentLyricIndex: number = -1
    private currentLyrics: LyricLineData[] = []
    private currentTrackId: string | number | undefined = undefined
    private checkInterval: any = null

    private constructor() {
        if (typeof window !== 'undefined' && isAndroidTauriRuntime()) {
            this.setupListeners()
        }
    }

    public static getInstance(): AndroidLyricService {
        if (!AndroidLyricService.instance) {
            AndroidLyricService.instance = new AndroidLyricService()
        }
        return AndroidLyricService.instance
    }

    private setupListeners() {
        // We use an interval to check the current time against the parsed lyrics
        // This is simpler and more reliable than trying to subscribe to every state change
        // since currentTime updates frequently.
        this.checkInterval = setInterval(() => {
            this.checkAndUpdateLyric()
        }, 300) // Check every 300ms

        // Also subscribe to track changes to reset parsing
        usePlayerStore.subscribe((state) => {
            if (state.currentTrack?.id !== this.currentTrackId) {
                this.currentTrackId = state.currentTrack?.id
                this.currentLyrics = parseLyrics(state.currentTrack)
                this.lastSentLyricIndex = -1
                
                if (!state.currentTrack) {
                    this.hideNotification()
                } else {
                    // Update immediately with track name or empty lyric
                    this.sendToAndroid(state.currentTrack.name, "Cyrene Music")
                }
            } else if (state.currentTrack) {
                // In case lyrics get updated after track loads (e.g. async fetch)
                const newLyrics = parseLyrics(state.currentTrack)
                if (newLyrics.length !== this.currentLyrics.length) {
                    this.currentLyrics = newLyrics
                    this.lastSentLyricIndex = -1
                }
            }

            if (!state.isPlaying && state.currentTrack) {
                // Optionally hide or update when paused, but usually we just leave it or hide it
                // We'll leave it but maybe not update the progress.
            }
        })
    }

    private checkAndUpdateLyric() {
        const state = usePlayerStore.getState()
        if (!state.isPlaying || !state.currentTrack || this.currentLyrics.length === 0) {
            return
        }

        const currentTime = state.currentTime * 1000 // ms

        // Find the active lyric line
        let activeIndex = -1
        for (let i = 0; i < this.currentLyrics.length; i++) {
            const line = this.currentLyrics[i]
            if (currentTime >= line.startTime && (i === this.currentLyrics.length - 1 || currentTime < this.currentLyrics[i + 1].startTime)) {
                activeIndex = i
                break
            }
        }

        if (activeIndex !== -1 && activeIndex !== this.lastSentLyricIndex) {
            this.lastSentLyricIndex = activeIndex
            
            let lyricText = ""
            if (this.currentLyrics[activeIndex].words && this.currentLyrics[activeIndex].words.length > 0) {
                lyricText = this.currentLyrics[activeIndex].words.map(w => w.text).join('')
            } else {
                lyricText = "♪"
            }

            this.sendToAndroid(state.currentTrack.name, lyricText)
        }
    }

    private sendToAndroid(title: string, lyric: string) {
        try {
            invoke('android_lyric_notification_update', {
                payload: {
                    title: title,
                    lyric: lyric
                }
            }).catch(console.warn)
        } catch (e) {
            console.warn(e)
        }
    }

    private hideNotification() {
        try {
            invoke('android_lyric_notification_hide').catch(console.warn)
        } catch (e) {
            console.warn(e)
        }
    }
}

export const androidLyricService = AndroidLyricService.getInstance()
