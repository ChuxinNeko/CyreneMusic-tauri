"use client"

import { Howl } from 'howler'
// 暂时停用插件生成的 SMTC，改用浏览器原生的 MediaSession
// import { 
//     initializeSession, 
//     mediaControls, 
//     PlaybackStatus, 
//     MediaControlEventType 
// } from 'tauri-plugin-media-api'
import { audioSourceService, AudioQuality } from "./audioSourceService"
import { AudioSourceType } from "../models/audioSourceConfig"
import { usePlayerStore } from "../store/usePlayerStore"
import { useAudioSourceStore } from "../store/useAudioSourceStore"
import { Track } from "../models/track"

import { listen, emit } from '@tauri-apps/api/event'

class PlayerService {
    private static instance: PlayerService
    private howl: Howl | null = null
    private progressInterval: any = null
    private fadeDuration = 500 // 500ms cross-fade

    private constructor() {
        if (typeof window !== "undefined") {
            this.setupSMTC()
            this.setupRemoteControl()
        }
    }

    private setupRemoteControl() {
        // Listen for commands from other windows (like Tray)
        listen('player:command', (event) => {
            const command = event.payload as string
            console.log(`[PlayerService] Received remote command: ${command}`)
            switch (command) {
                case 'toggle-play':
                    this.togglePlay()
                    break
                case 'next':
                    this.playNext()
                    break
                case 'prev':
                    this.playPrevious()
                    break
            }
        })
    }

    public static getInstance(): PlayerService {
        if (!PlayerService.instance) {
            PlayerService.instance = new PlayerService()
        }
        return PlayerService.instance
    }

    private async setupSMTC() {
        // try {
        //     await initializeSession('com.cyrene.music', 'Cyrene Music')

        //     // Register SMTC events
        //     mediaControls.setEventHandler((event) => {
        //         switch (event.eventType) {
        //             case MediaControlEventType.Play:
        //             case MediaControlEventType.Pause:
        //             case MediaControlEventType.PlayPause:
        //                 this.togglePlay()
        //                 break
        //             case MediaControlEventType.Next:
        //                 this.playNext()
        //                 break
        //             case MediaControlEventType.Previous:
        //                 this.playPrevious()
        //                 break
        //             case MediaControlEventType.SeekTo:
        //             case MediaControlEventType.SetPosition:
        //                 if (event.data !== undefined) {
        //                     this.seek(Number(event.data))
        //                 }
        //                 break
        //             default:
        //                 break
        //         }
        //     })
        //     console.log("[PlayerService] SMTC registered and initialized")
        // } catch (error) {
        //     console.error("[PlayerService] Failed to register SMTC:", error)
        // }
    }

    private setupEvents(howl: Howl) {
        howl.on('play', () => {
            usePlayerStore.getState().setIsPlaying(true)
            usePlayerStore.getState().setIsLoading(false)
            this.startProgressTimer()
            // Update SMTC state (WebView2 will handle this via MediaSession automagically if synchronized)
            this.broadcastState()
        })

        howl.on('pause', () => {
            usePlayerStore.getState().setIsPlaying(false)
            this.stopProgressTimer()
            this.broadcastState()
        })

        howl.on('load', () => {
            usePlayerStore.getState().setIsLoading(false)
            const duration = howl.duration()
            usePlayerStore.getState().setDuration(duration)

            // Update metadata with duration
            const track = usePlayerStore.getState().currentTrack
            if (track) {
                this.updateSMTCMetadata(track, duration)
            }
        })

        howl.on('loaderror', (id, err) => {
            console.error("[PlayerService] Howl load error:", id, err)
            usePlayerStore.getState().setIsLoading(false)
            usePlayerStore.getState().setIsPlaying(false)
        })

        howl.on('end', () => {
            usePlayerStore.getState().playNext()
            const nextTrack = usePlayerStore.getState().currentTrack
            if (nextTrack) {
                this.playTrack(nextTrack)
            }
        })
    }

    private startProgressTimer() {
        this.stopProgressTimer()
        this.progressInterval = setInterval(() => {
            if (this.howl && this.howl.playing()) {
                const currentTime = this.howl.seek() as number
                const duration = this.howl.duration()
                if (duration) {
                    usePlayerStore.getState().setCurrentTime(currentTime)
                    usePlayerStore.getState().setProgress(currentTime / duration)
                }
            }
        }, 1000)
    }

    private stopProgressTimer() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval)
            this.progressInterval = null
        }
    }

    private updateSMTCMetadata(track: Track, duration?: number) {
        try {
            // 广播至其他窗口 (如托盘)
            this.broadcastState()

            // 仅使用浏览器内置 MediaSession (WebView2 SMTC)
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.name,
                    artist: track.artists,
                    album: track.album || '',
                    artwork: [
                        { src: track.picUrl || '', sizes: '512x512', type: 'image/jpeg' }
                    ]
                })

                // 设置浏览器侧的操作处理，确保与 App 逻辑一致
                navigator.mediaSession.setActionHandler('play', () => this.togglePlay())
                navigator.mediaSession.setActionHandler('pause', () => this.togglePlay())
                navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious())
                navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext())
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.seekTime !== undefined) {
                        this.seek(details.seekTime)
                    }
                })
            }
        } catch (error) {
            console.error("[PlayerService] Failed to set SMTC metadata:", error)
        }
    }

    public async playTrack(track: Track) {
        try {
            usePlayerStore.getState().setIsLoading(true)
            usePlayerStore.getState().setCurrentTrack(track)

            // Update SMTC metadata (preliminary)
            this.updateSMTCMetadata(track)

            // Get active audio source config
            const activeConfigSource = useAudioSourceStore.getState().getActiveSource()
            if (!activeConfigSource) {
                throw new Error("No active audio source configured")
            }

            // Build initial playback URL
            const quality = AudioQuality.ExHigh
            let url = audioSourceService.buildPlaybackUrl(
                activeConfigSource,
                track.source as any,
                track.id,
                quality
            )

            if (!url) {
                throw new Error(`Failed to build playback URL for source: ${track.source}`)
            }

            // Special handling for OmniParse Netease Form POST
            if (activeConfigSource.type === AudioSourceType.OmniParse && track.source === 'netease') {
                const baseUrl = activeConfigSource.url.replace(/\/$/, '')
                const apiUrl = `${baseUrl}/song`

                const formData = new URLSearchParams()
                formData.append('ids', track.id.toString())
                formData.append('url', '')
                formData.append('level', quality)
                formData.append('type', 'json')

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-API-Key': activeConfigSource.apiKey || ''
                    },
                    body: formData.toString()
                })

                const result = await response.json()
                if (result.status === 200 && result.url) {
                    url = result.url
                } else {
                    throw new Error(`Failed to fetch Netease real URL: ${result.msg || 'Unknown error'}`)
                }
            }

            console.log(`[PlayerService] Playing via Howler (MediaSession fallback): ${track.name}`)

            // Handle Cross-fade for existing audio
            if (this.howl) {
                const oldHowl = this.howl
                oldHowl.fade(oldHowl.volume(), 0, this.fadeDuration)
                setTimeout(() => oldHowl.unload(), this.fadeDuration)
            }

            // Create new Howl instance
            this.howl = new Howl({
                src: [url],
                html5: true,
                volume: usePlayerStore.getState().volume,
                autoplay: true,
                format: ['mp3', 'flac', 'm4a', 'wav']
            })

            this.setupEvents(this.howl)

            // Force state update for UI
            usePlayerStore.getState().setIsPlaying(true)
            usePlayerStore.getState().setIsLoading(false)
        } catch (error) {
            console.error("[PlayerService] Play error:", error)
            usePlayerStore.getState().setIsLoading(false)
        }
    }

    public playNext() {
        usePlayerStore.getState().playNext()
        const nextTrack = usePlayerStore.getState().currentTrack
        if (nextTrack) {
            this.playTrack(nextTrack)
        }
    }

    public playPrevious() {
        usePlayerStore.getState().playPrevious()
        const prevTrack = usePlayerStore.getState().currentTrack
        if (prevTrack) {
            this.playTrack(prevTrack)
        }
    }

    public togglePlay() {
        if (!this.howl) return
        if (this.howl.playing()) {
            this.howl.pause()
        } else {
            this.howl.play()
        }
    }

    public seek(time: number) {
        if (this.howl) {
            this.howl.seek(time)
            usePlayerStore.getState().setCurrentTime(time)
        }
    }

    public setVolume(volume: number) {
        if (this.howl) {
            this.howl.volume(volume)
        }
        usePlayerStore.getState().setVolume(volume)
    }

    private broadcastState() {
        if (typeof window === 'undefined') return
        const state = usePlayerStore.getState()
        emit('player:state-change', {
            currentTrack: state.currentTrack,
            isPlaying: state.isPlaying
        })
    }

    public cleanup() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null
        }
    }
}

export const playerService = PlayerService.getInstance()
