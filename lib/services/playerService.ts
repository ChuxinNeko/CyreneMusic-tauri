"use client"

import { Howl } from 'howler'
import { audioAnalyser } from './audioAnalyser'
import { audioSourceService, AudioQuality } from "./audioSourceService"
import { urlService } from "./urlService"
import { AudioSourceType } from "../models/audioSourceConfig"
import { usePlayerStore } from "../store/usePlayerStore"
import { useAudioSourceStore } from "../store/useAudioSourceStore"
import { Track } from "../models/track"
import { historyService } from "./historyService"
import { lxMusicRuntimeService } from "./lxMusicRuntimeService"
import { androidMediaNotificationService, isAndroidTauriRuntime } from "./androidMediaNotificationService"

import { listen, emit } from '@tauri-apps/api/event'

class PlayerService {
    private static instance: PlayerService
    private howl: Howl | null = null
    private progressInterval: any = null
    private fadeDuration = 500 // 500ms cross-fade
    private androidMediaBridgeBound = false
    private fallbackQualityUrl: string | null = null // 播放失败时的备选 (通常为 320k) URL

    private constructor() {
        if (typeof window !== "undefined") {
            this.setupSMTC()
            this.setupRemoteControl()
            this.setupAndroidNativeMediaControls()
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
                case 'request-sync':
                    if (typeof window !== 'undefined') {
                        const state = usePlayerStore.getState()
                        emit('player:state-change', {
                            currentTrack: state.currentTrack,
                            isPlaying: state.isPlaying
                        })
                        emit('player:time-sync', {
                            time: this.getCurrentTime(),
                            timestamp: Date.now(),
                            isPlaying: state.isPlaying
                        })
                        emit('player:settings-sync', {
                            desktopLyricFontSize: state.desktopLyricFontSize,
                            desktopLyricColor: state.desktopLyricColor,
                            desktopLyricStrokeColor: state.desktopLyricStrokeColor
                        })
                    }
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

    private setupAndroidNativeMediaControls() {
        if (!isAndroidTauriRuntime() || this.androidMediaBridgeBound) {
            return
        }

        window.addEventListener("cyrene:android-media-action", (event: Event) => {
            const detail = (event as CustomEvent<{ action?: string }>).detail
            switch (detail?.action) {
                case "toggle-play":
                    this.togglePlay()
                    break
                case "next":
                    this.playNext()
                    break
                case "prev":
                    this.playPrevious()
                    break
            }
        })

        this.androidMediaBridgeBound = true
    }

    private syncAndroidMediaNotification(force = false) {
        if (!isAndroidTauriRuntime()) {
            return
        }

        const state = usePlayerStore.getState()
        if (!state.currentTrack) {
            if (force) {
                androidMediaNotificationService.hide()
            }
            return
        }

        androidMediaNotificationService.sync(
            state.currentTrack,
            state.isPlaying,
            this.getCurrentTime(),
            state.duration
        )
    }

    private setupEvents(howl: Howl) {
        howl.on('play', () => {
            usePlayerStore.getState().setIsPlaying(true)
            usePlayerStore.getState().setIsLoading(false)
            this.startProgressTimer()
            this.broadcastState()
            this.syncAndroidMediaNotification(true)
            
            // 同步 MediaSession 状态
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing'
                this.updateMediaSessionPosition()
            }

            // 连接音频分析器以获取实时频率数据
            audioAnalyser.connectToHowl(howl)
        })

        howl.on('pause', () => {
            usePlayerStore.getState().setIsPlaying(false)
            this.stopProgressTimer()
            this.broadcastState()
            this.syncAndroidMediaNotification(true)

            // 同步 MediaSession 状态
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused'
            }

            // 暂停时立刻同步一次时间，防止悬浮歌词继续插值
            if (typeof window !== 'undefined') {
                emit('player:time-sync', {
                    time: this.howl ? this.howl.seek() as number : usePlayerStore.getState().currentTime,
                    timestamp: Date.now(),
                    isPlaying: false
                })
            }
        })

        howl.on('load', () => {
            usePlayerStore.getState().setIsLoading(false)
            const duration = howl.duration()
            usePlayerStore.getState().setDuration(duration)
            this.syncAndroidMediaNotification(true)

            const track = usePlayerStore.getState().currentTrack
            if (track) {
                this.updateSMTCMetadata(track, duration)
                this.updateMediaSessionPosition()
            }
        })

        howl.on('loaderror', (id, err) => {
            console.error("[PlayerService] Howl load error:", id, err)

            // 简化降级策略：如果请求失败，统一降级调用 320k 音质
            if (this.fallbackQualityUrl) {
                const nextUrl = this.fallbackQualityUrl
                console.warn(`[PlayerService] 请求失败 (可能 403)，正在尝试调用备选 320k 音质...`)
                console.log(`[PlayerService] 尝试加载 320k URL: ${nextUrl}`)
                this.fallbackQualityUrl = null // 确保只重试一次，防止无限重试
                usePlayerStore.getState().setIsLoading(true)
                this.initHowl(nextUrl)
                return
            }

            console.error("[PlayerService] 备选 URL 也尝试失败或不存在。")
            usePlayerStore.getState().setIsLoading(false)
            usePlayerStore.getState().setIsPlaying(false)
            this.syncAndroidMediaNotification(true)
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

                // 发送高精度时间同步，供悬浮歌词窗口进行顺滑插值
                if (typeof window !== 'undefined') {
                    emit('player:time-sync', {
                        time: currentTime,
                        timestamp: Date.now(),
                        isPlaying: true
                    })
                }

                this.syncAndroidMediaNotification()

                // 累积听歌时长
                const currentTrack = usePlayerStore.getState().currentTrack
                if (currentTrack) {
                    historyService.recordTime(currentTrack.id, currentTrack.source, 1)
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
                const artwork = track.picUrl ? [
                    { src: track.picUrl, sizes: '96x96', type: 'image/jpeg' },
                    { src: track.picUrl, sizes: '128x128', type: 'image/jpeg' },
                    { src: track.picUrl, sizes: '192x192', type: 'image/jpeg' },
                    { src: track.picUrl, sizes: '256x256', type: 'image/jpeg' },
                    { src: track.picUrl, sizes: '384x384', type: 'image/jpeg' },
                    { src: track.picUrl, sizes: '512x512', type: 'image/jpeg' },
                ] : []

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.name,
                    artist: track.artists,
                    album: track.album || '',
                    artwork: artwork
                })

                // 安卓通知栏状态显示至关重要：告诉系统当前是否在播放
                navigator.mediaSession.playbackState = this.howl?.playing() ? 'playing' : 'paused'

                // 设置操作处理函数
                const actionHandlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
                    ['play', () => this.togglePlay()],
                    ['pause', () => this.togglePlay()],
                    ['previoustrack', () => this.playPrevious()],
                    ['nexttrack', () => this.playNext()],
                    ['stop', () => {
                        this.howl?.stop()
                        navigator.mediaSession.playbackState = 'none'
                    }],
                    ['seekto', (details) => {
                        if (details.seekTime !== undefined) {
                            this.seek(details.seekTime)
                            this.updateMediaSessionPosition()
                        }
                    }]
                ]

                for (const [action, handler] of actionHandlers) {
                    try {
                        navigator.mediaSession.setActionHandler(action, handler)
                    } catch (e) {
                        console.warn(`[PlayerService] Action handler for ${action} not supported`)
                    }
                }

                // 如果有时长信息，立刻同步进度
                if (duration) {
                    this.updateMediaSessionPosition()
                }
            }
        } catch (error) {
            console.error("[PlayerService] Failed to set SMTC metadata:", error)
        }
    }

    /**
     * 同步播放进度到 MediaSession，确保安卓通知栏进度条正常工作
     */
    private updateMediaSessionPosition() {
        if (!this.howl || !('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) {
            return
        }

        try {
            const currentTime = this.howl.seek() as number
            const duration = this.howl.duration()

            if (duration && duration > 0) {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: 1,
                    position: Math.min(currentTime, duration)
                })
            }
        } catch (e) {
            console.warn("[PlayerService] Failed to set MediaSession position state:", e)
        }
    }

    public async playWithQueue(track: Track, newQueue: Track[]) {
        try {
            const store = usePlayerStore.getState()
            store.setQueue(newQueue)
            await this.playTrack(track)
        } catch (error) {
            console.error("[PlayerService] playWithQueue error:", error)
        }
    }

    public async playTrack(track: Track) {
        try {
            if (this.howl) {
                this.howl.stop()
                this.howl.unload()
                this.howl = null
            }
            this.stopProgressTimer()

            usePlayerStore.getState().setIsLoading(true)
            usePlayerStore.getState().setCurrentTrack(track)
            this.fallbackQualityUrl = null // 重置备选 URL

            // 记录播放次数
            historyService.recordPlay(track)

            this.updateSMTCMetadata(track)
            this.syncAndroidMediaNotification(true)

            // 异步获取副歌时间
            if (track.source === 'netease') {
                const chorusUrl = `${urlService.baseUrl}/song/chorus?id=${track.id}`;
                fetch(chorusUrl)
                    .then(res => res.json())
                    .then(res => {
                        const chorusData = res?.chorus || res?.data;
                        if (chorusData && Array.isArray(chorusData)) {
                            const currentTrack = usePlayerStore.getState().currentTrack;
                            if (currentTrack && currentTrack.id === track.id) {
                                usePlayerStore.getState().updateTrackLyrics({
                                    chorus: chorusData
                                });
                            }
                        }
                    })
                    .catch(e => console.warn('[PlayerService] Failed to fetch Netease chorus:', e));
            }

            const activeConfigSource = useAudioSourceStore.getState().getActiveSource()
            if (!activeConfigSource) {
                throw new Error("No active audio source configured")
            }

            const quality = useAudioSourceStore.getState().quality as AudioQuality
            let url = audioSourceService.buildPlaybackUrl(
                activeConfigSource,
                track.source as any,
                track.id,
                quality
            )

            if (!url) {
                throw new Error(`Failed to build playback URL for source: ${track.source}`)
            }

            if (activeConfigSource.type === AudioSourceType.LxMusic) {
                console.log("[PlayerService] Using LxMusic Runtime for URL fetching");

                // 确保运行时已加载当前脚本
                await lxMusicRuntimeService.loadScript({
                    name: activeConfigSource.name,
                    version: activeConfigSource.version,
                    script: activeConfigSource.scriptContent
                });

                const lxSourceMap: Record<string, string> = {
                    'netease': 'wy',
                    'qq': 'tx',
                    'kugou': 'kg',
                    'kuwo': 'kw'
                };
                const lxSource = lxSourceMap[track.source] || track.source;

                try {
                    const realUrl = await lxMusicRuntimeService.getMusicUrl(lxSource, track.id, audioSourceService.getLxQuality(quality));

                    if (realUrl) {
                        url = realUrl;
                        console.log(`[PlayerService] Using real URL from LxMusic: ${url}`);

                        // 并行请求网易云歌词接口 /lyrics/netease?id=xxx
                        if (track.source === 'netease') {
                            const lyricUrl = `${urlService.baseUrl}/lyrics/netease?id=${track.id}`;
                            fetch(lyricUrl)
                                .then(res => res.json())
                                .then(lyricResult => {
                                    console.log('[PlayerService] /lyrics/netease Response:', lyricResult);
                                    const lyricData = lyricResult?.data || lyricResult;
                                    if (lyricData?.lyric || lyricData?.yrc) {
                                        const currentTrack = usePlayerStore.getState().currentTrack;
                                        if (currentTrack && currentTrack.id === track.id) {
                                            usePlayerStore.getState().updateTrackLyrics({
                                                lyric: lyricData.lyric || '',
                                                tlyric: lyricData.tlyric || '',
                                                yrc: lyricData.yrc || '',
                                                ytlrc: lyricData.ytlrc || '',
                                            });
                                        }
                                    }
                                })
                                .catch(e => console.warn('[PlayerService] Failed to fetch Netease lyrics:', e));
                        } else if (track.source === 'qq') {
                            const lyricUrl = `${urlService.baseUrl}/lyrics/qq?id=${track.id}`;
                            fetch(lyricUrl)
                                .then(res => res.json())
                                .then(lyricResult => {
                                    console.log('[PlayerService] /lyrics/qq Response:', lyricResult);
                                    const lyricData = lyricResult?.data || lyricResult;
                                    if (lyricData?.lyric || lyricData?.qrc) {
                                        const currentTrack = usePlayerStore.getState().currentTrack;
                                        if (currentTrack && currentTrack.id === track.id) {
                                            usePlayerStore.getState().updateTrackLyrics({
                                                lyric: lyricData.lyric || '',
                                                tlyric: lyricData.tlyric || '',
                                                yrc: lyricData.qrc || '',
                                                ytlrc: lyricData.qrcTrans || '',
                                            });
                                        }
                                    }
                                })
                                .catch(e => console.warn('[PlayerService] Failed to fetch QQ lyrics:', e));
                        } else if (track.source === 'kugou') {
                            const hash = String(track.id).split(':')[0];
                            if (hash) {
                                const lyricUrl = `${urlService.baseUrl}/lyrics/kugou?hash=${hash}`;
                                fetch(lyricUrl)
                                    .then(res => res.json())
                                    .then(lyricResult => {
                                        console.log('[PlayerService] /lyrics/kugou Response:', lyricResult);
                                        const lyricData = lyricResult?.data || lyricResult;
                                        if (lyricData?.lyric) {
                                            const currentTrack = usePlayerStore.getState().currentTrack;
                                            if (currentTrack && currentTrack.id === track.id) {
                                                usePlayerStore.getState().updateTrackLyrics({
                                                    lyric: lyricData.lyric || '',
                                                    tlyric: lyricData.tlyric || '',
                                                });
                                            }
                                        }
                                    })
                                    .catch(e => console.warn('[PlayerService] Failed to fetch Kugou lyrics:', e));
                            }
                        }
                    } else {
                        throw new Error("LxMusic Runtime returned empty URL");
                    }
                } catch (e: any) {
                    console.error("[PlayerService] LxMusic Runtime failed:", e);
                    throw new Error(`洛雪音源插件获取 URL 失败: ${e.message}`);
                }
            }

            if (activeConfigSource.type === AudioSourceType.OmniParse && track.source === 'netease') {
                const baseUrl = activeConfigSource.url.replace(/\/$/, '')
                const apiUrl = `${baseUrl}/song`

                const neteaseQualityMap: Record<string, string> = {
                    '128k': 'standard',
                    '320k': 'exhigh',
                    'flac': 'lossless',
                    'flac24bit': 'hires',
                    'standard': 'standard',
                    'exhigh': 'exhigh',
                    'lossless': 'lossless',
                    'hires': 'hires',
                    'jyeffect': 'jyeffect',
                    'sky': 'sky',
                    'jymaster': 'jymaster'
                };
                const mappedQuality = neteaseQualityMap[quality] || quality;

                const formData = new URLSearchParams()
                formData.append('ids', track.id.toString())
                formData.append('url', '')
                formData.append('level', mappedQuality)
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
                        extractedUrl = musicUrls.flac?.url || musicUrls['320']?.url || musicUrls['128']?.url || ''

                        // 准备 320k 备选 URL (如果当前选中的已经不是 320k/128k 的话)
                        const backupUrl = musicUrls['320']?.url || musicUrls['128']?.url || ''
                        if (backupUrl && backupUrl !== extractedUrl) {
                            this.fallbackQualityUrl = backupUrl
                        }

                        console.log(`[PlayerService] QQ 选定 URL: ${extractedUrl}`)
                        console.log(`[PlayerService] QQ 备选 320k 状态: ${this.fallbackQualityUrl ? '已就绪' : '无备选'}`)

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

            // 对酷狗资源的 https URL 强制降级为 http，解决证书校验和部分 CDN 403 阻断
            if (track.source === 'kugou' && url.startsWith('https://')) {
                url = url.replace('https://', 'http://')
                console.log(`[PlayerService] 酷狗音频自动降级为 HTTP 以规避 403 / 证书错误:`, url)
            }

            console.log(`[PlayerService] Playing via Howler: ${track.name}`)
            // 验证：模拟首个 URL 失败以触发降级
            // url = "http://invalid-url-for-test.mp3" 
            this.initHowl(url)
        } catch (error) {
            console.error("[PlayerService] Play error:", error)
            usePlayerStore.getState().setIsLoading(false)
        }
    }

    private initHowl(url: string) {
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

            if (typeof window !== 'undefined') {
                emit('player:time-sync', {
                    time: time,
                    timestamp: Date.now(),
                    isPlaying: this.howl.playing()
                })
            }
            this.updateMediaSessionPosition()
            this.syncAndroidMediaNotification(true)
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
        androidMediaNotificationService.hide()
    }
}

export const playerService = PlayerService.getInstance()
