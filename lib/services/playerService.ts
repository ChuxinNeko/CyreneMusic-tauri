"use client"

import { Howl } from 'howler'
import { audioAnalyser } from './audioAnalyser'
import { audioSourceService, AudioQuality } from "./audioSourceService"
import { urlService } from "./urlService"
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
        // SMTC setup placeholder
    }

    private setupEvents(howl: Howl) {
        howl.on('play', () => {
            usePlayerStore.getState().setIsPlaying(true)
            usePlayerStore.getState().setIsLoading(false)
            this.startProgressTimer()
            this.broadcastState()
            // 连接音频分析器以获取实时频率数据
            audioAnalyser.connectToHowl(howl)
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
            this.broadcastState()
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.name,
                    artist: track.artists,
                    album: track.album || '',
                    artwork: [
                        { src: track.picUrl || '', sizes: '512x512', type: 'image/jpeg' }
                    ]
                })

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

            this.updateSMTCMetadata(track)

            const activeConfigSource = useAudioSourceStore.getState().getActiveSource()
            if (!activeConfigSource) {
                throw new Error("No active audio source configured")
            }

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
                console.log("[PlayerService] /song Response:", result)
                if (result.status === 200 && result.url) {
                    url = result.url
                    if (result.lyric || result.yrc) {
                        const updatedTrack = { ...track, lyric: result.lyric, yrc: result.yrc, tlyric: result.tlyric, ytlrc: result.ytlrc }
                        usePlayerStore.getState().setCurrentTrack(updatedTrack)
                    }
                } else {
                    throw new Error(`Failed to fetch Netease real URL: ${result.msg || 'Unknown error'}`)
                }
            }

            // QQ / 酷狗 / 酷我等 OmniParse GET 类音源，同样需要携带 API Key
            const omniParseGetSources = ['qq', 'kugou', 'kuwo'] as const
            if (activeConfigSource.type === AudioSourceType.OmniParse && (omniParseGetSources as readonly string[]).includes(track.source)) {
                const response = await fetch(url, {
                    headers: {
                        'X-API-Key': activeConfigSource.apiKey || ''
                    }
                })

                const result = await response.json()
                console.log(`[PlayerService] /${track.source}/song Response:`, result)

                if (result.status === 200) {
                    let extractedUrl = ''

                    if (track.source === 'qq') {
                        // QQ 返回 { status, song, music_urls: { "128": { url }, "320": { url }, "flac": { url } } }
                        const musicUrls = result.music_urls || {}
                        // 按音质优先级：flac > 320 > 128
                        extractedUrl = musicUrls.flac?.url || musicUrls['320']?.url || musicUrls['128']?.url || ''

                        // 并行请求专门的歌词路由 /lyrics/qq?id=xxx
                        const lyricUrl = `${urlService.baseUrl}/lyrics/qq?id=${track.id}`
                        fetch(lyricUrl)
                            .then(res => res.json())
                            .then(lyricResult => {
                                console.log('[PlayerService] /lyrics/qq Response:', lyricResult)
                                const lyricData = lyricResult?.data || lyricResult
                                const lyricText = lyricData?.lyric || ''
                                const tlyricText = lyricData?.tlyric || ''
                                // QRC 逐字歌词 → 存入 yrc 字段；QRC 翻译 → 存入 ytlrc 字段
                                const qrcText = lyricData?.qrc || ''
                                const qrcTransText = lyricData?.qrcTrans || ''
                                if (lyricText || qrcText) {
                                    const currentTrack = usePlayerStore.getState().currentTrack
                                    if (currentTrack && currentTrack.id === track.id) {
                                        usePlayerStore.getState().updateTrackLyrics({
                                            lyric: lyricText,
                                            tlyric: tlyricText,
                                            yrc: qrcText,
                                            ytlrc: qrcTransText,
                                        })
                                    }
                                }
                            })
                            .catch(e => console.warn('[PlayerService] Failed to fetch QQ lyrics:', e))
                    } else if (track.source === 'kugou') {
                        // 酷狗返回 { status, song: { url, ... } }
                        const songData = result.song || result
                        extractedUrl = songData.url || ''

                        // 并行请求酷狗歌词 /lyrics/kugou?hash=xxx
                        // track.id 格式为 "hash:albumId"，提取 hash 部分
                        const kugouHash = String(track.id).split(':')[0]
                        if (kugouHash) {
                            const lyricUrl = `${urlService.baseUrl}/lyrics/kugou?hash=${kugouHash}`
                            fetch(lyricUrl)
                                .then(res => res.json())
                                .then(lyricResult => {
                                    console.log('[PlayerService] /lyrics/kugou Response:', lyricResult)
                                    const lyricData = lyricResult?.data || lyricResult
                                    const lyricText = lyricData?.lyric || ''
                                    const tlyricText = lyricData?.tlyric || ''
                                    if (lyricText) {
                                        const currentTrack = usePlayerStore.getState().currentTrack
                                        if (currentTrack && currentTrack.id === track.id) {
                                            usePlayerStore.getState().updateTrackLyrics({
                                                lyric: lyricText,
                                                tlyric: tlyricText,
                                            })
                                        }
                                    }
                                })
                                .catch(e => console.warn('[PlayerService] Failed to fetch Kugou lyrics:', e))
                        }
                    } else {
                        // 酷我返回 { status, song: { url, ... } }
                        const songData = result.song || result
                        extractedUrl = songData.url || ''
                    }

                    if (extractedUrl) {
                        url = extractedUrl
                    } else {
                        throw new Error(`Failed to fetch ${track.source} real URL: no playback URL found`)
                    }
                } else {
                    throw new Error(`Failed to fetch ${track.source} real URL: ${result.msg || 'Unknown error'}`)
                }
            }

            console.log(`[PlayerService] Playing via Howler: ${track.name}`)

            if (this.howl) {
                const oldHowl = this.howl
                this.howl = null
                oldHowl.stop()
                oldHowl.unload()
            }

            this.howl = new Howl({
                src: [url],
                html5: true,
                volume: usePlayerStore.getState().volume,
                autoplay: false,
                format: ['mp3', 'flac', 'm4a', 'wav']
            })

            // 设置 crossOrigin 以允许 Web Audio API 读取跨域音频的频率数据
            try {
                const sounds = (this.howl as any)._sounds
                if (sounds?.[0]?._node) {
                    const audioEl = sounds[0]._node as HTMLAudioElement
                    audioEl.crossOrigin = "anonymous"
                    console.log('[PlayerService] Set crossOrigin on audio element')
                }
            } catch (e) {
                console.warn('[PlayerService] Failed to set crossOrigin:', e)
            }

            this.setupEvents(this.howl)
            this.howl.play()
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

    /**
     * 获取实时播放位置（秒），直接从 Howl 读取，不经过 Zustand store 的 1s 延迟。
     * 用于逐字歌词等需要高精度时间的场景。
     */
    public getCurrentTime(): number {
        if (this.howl && this.howl.playing()) {
            return this.howl.seek() as number
        }
        return usePlayerStore.getState().currentTime
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
        // Cleanup logic
    }
}

export const playerService = PlayerService.getInstance()
