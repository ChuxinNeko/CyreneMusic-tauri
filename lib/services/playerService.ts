"use client"

import { Howl } from 'howler'
import { audioAnalyser } from './audioAnalyser'
import { audioSourceService, AudioQuality } from "./audioSourceService"
import { urlService } from "./urlService"
import { AudioSourceType } from "../models/audioSourceConfig"
import { usePlayerStore, RepeatMode } from "../store/usePlayerStore"
import { useAudioSourceStore } from "../store/useAudioSourceStore"
import { Track } from "../models/track"
import { historyService } from "./historyService"
import { lxMusicRuntimeService } from "./lxMusicRuntimeService"
import { androidMediaNotificationService, isAndroidTauriRuntime } from './androidMediaNotificationService'
import { androidLyricService } from './androidLyricService'
import { cacheService } from './cacheService'
import { useCacheStore } from '../store/useCacheStore'
import { toast } from 'sonner'

import { listen, emit as tauriEmit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

const emit = async (event: string, payload?: any) => {
    try {
        if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
            await tauriEmit(event, payload)
        }
    } catch (e) {
        // Ignore emit errors in non-Tauri environments
    }
}

class AudioSourceError extends Error {
    rawJson?: any;
    rawText?: string;
    status?: number;

    constructor(message: string, options?: { rawJson?: any; rawText?: string; status?: number }) {
        super(message);
        this.name = 'AudioSourceError';
        this.rawJson = options?.rawJson;
        this.rawText = options?.rawText;
        this.status = options?.status;
        Object.setPrototypeOf(this, AudioSourceError.prototype);
    }
}

class PlayerService {
    private static instance: PlayerService
    private howl: Howl | null = null
    private progressInterval: any = null
    private fadeDuration = 500 // 500ms cross-fade
    private androidMediaBridgeBound = false
    private fallbackQualityUrl: string | null = null // 播放失败时的备选 (通常为 320k) URL
    private currentPlayingUrl: string | null = null // 当前正在加载或播放的音频链接
    // 缓存预解析 Promise，Key 为 "音源ID_音质_平台_歌曲ID"
    private prefetchPromises = new Map<string, Promise<{ url: string; fallbackUrl: string | null; lyrics?: any }>>()
    // 随机播放模式下的“内定”下一首和下二首歌曲，用以解决随机预载命中率问题
    private nextRandomTrack: Track | null = null
    private nextRandomTrack2: Track | null = null
    // 当前正在执行的播放请求的唯一 ID，用以解决快速切歌时的竞态冲突与进度抽搐问题
    private currentPlayRequestId: string | null = null

    private constructor() {
        if (typeof window !== "undefined") {
            this.setupSMTC()
            this.setupRemoteControl()
            this.setupAndroidNativeMediaControls()
            
            // 确保实例化歌词推送服务
            androidLyricService;
        }
    }

    private getPrefetchKey(track: Track, sourceId: string, quality: string): string {
        return `${sourceId}_${quality}_${track.source}_${track.id}`
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
            this.syncThumbbarState(true)

            // 同步 MediaSession 状态
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing'
                this.updateMediaSessionPosition()
            }

            // 连接音频分析器以获取实时频率数据（Android 端不连接，避免在后台时由于 WebAudio 降级导致播放卡顿）
            if (!isAndroidTauriRuntime()) {
                audioAnalyser.connectToHowl(howl)
            }
        })

        howl.on('pause', () => {
            usePlayerStore.getState().setIsPlaying(false)
            this.stopProgressTimer()
            this.broadcastState()
            this.syncAndroidMediaNotification(true)
            this.syncThumbbarState(false)

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

            const handleFinalError = (msg: string) => {
                usePlayerStore.getState().setPlayError(msg)
                toast.error(`播放失败: ${msg}`)
                usePlayerStore.getState().setIsLoading(false)
                usePlayerStore.getState().setIsPlaying(false)
                this.syncAndroidMediaNotification(true)
            }

            const defaultMsg = typeof err === 'number' ? `音频解码或加载失败 (代码 ${err})` : String(err || "网络连接中断或音源文件已失效");

            if (this.currentPlayingUrl && this.currentPlayingUrl.startsWith('http')) {
                // 发起极轻量级的 Range 请求以探测真实 HTTP 状态码和响应内容
                fetch(this.currentPlayingUrl, {
                    method: 'GET',
                    headers: { 'Range': 'bytes=0-1' }
                })
                    .then(async (res) => {
                        const contentType = res.headers.get('content-type') || ""
                        if (!res.ok) {
                            const resText = await res.text().catch(() => "")
                            const detailedMsg = `链接被服务器拒绝 (HTTP ${res.status}): ${resText.slice(0, 80) || res.statusText}`
                            handleFinalError(detailedMsg)
                        } else if (
                            contentType.includes('application/json') ||
                            contentType.includes('text/json') ||
                            contentType.includes('text/plain') ||
                            contentType.includes('text/html')
                        ) {
                            // 有可能返回了 200 状态码的 JSON/HTML 错误页面
                            const resText = await res.text().catch(() => "")
                            const trimmed = resText.trim()

                            if (trimmed.startsWith('{') || resText.includes('"msg"') || resText.includes('"error"') || resText.includes('"status"')) {
                                try {
                                    const parsed = JSON.parse(trimmed)
                                    const parts: string[] = []
                                    Object.entries(parsed).forEach(([key, val]) => {
                                        if (val !== null && val !== undefined && val !== "") {
                                            const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
                                            parts.push(`${key}: ${strVal}`)
                                        }
                                    })
                                    const detailedMsg = `音源服务器返回: { ${parts.join(', ')} }`
                                    handleFinalError(detailedMsg)
                                } catch (e) {
                                    const detailedMsg = `音源服务返回非音频文本 (疑似报错): ${resText.slice(0, 80)}`
                                    handleFinalError(detailedMsg)
                                }
                            } else if (resText.includes('<!DOCTYPE html>') || resText.includes('<html')) {
                                const detailedMsg = `音源服务返回 HTML 错误页面，可能接口已崩溃或被网关拦截`
                                handleFinalError(detailedMsg)
                            } else if (resText.length < 200 && resText.length > 0) {
                                const detailedMsg = `音源服务异常提示: ${resText}`
                                handleFinalError(detailedMsg)
                            } else {
                                handleFinalError(defaultMsg)
                            }
                        } else {
                            handleFinalError(defaultMsg)
                        }
                    })
                    .catch((fetchErr: any) => {
                        const detailedMsg = `链接请求超时或被安全阻断: ${fetchErr.message || fetchErr}`
                        handleFinalError(detailedMsg)
                    })
            } else {
                handleFinalError(defaultMsg)
            }
        })

        howl.on('end', () => {
            this.playNext()
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
        const requestId = `${track.source}_${track.id}_${Date.now()}`;
        this.currentPlayRequestId = requestId;

        try {
            if (this.howl) {
                this.howl.stop()
                this.howl.unload()
                this.howl = null
            }
            this.stopProgressTimer()

            usePlayerStore.getState().setIsLoading(true)
            usePlayerStore.getState().setCurrentTrack(track)
            usePlayerStore.getState().setPlayError(null)
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

            // 本地文件：直接使用 asset protocol URL
            if (track.source === 'local' && track.filePath) {
                const { convertFileSrc } = await import('@tauri-apps/api/core');
                if (this.currentPlayRequestId !== requestId) return;
                const assetUrl = convertFileSrc(track.filePath);

                // 加载歌词：优先内嵌，fallback 到 .lrc 文件
                if (!track.lyric) {
                    import('./localMusicService').then(({ localMusicService }) => {
                        localMusicService.loadLrcForTrack(track).then(lrc => {
                            if (lrc) {
                                const currentTrack = usePlayerStore.getState().currentTrack;
                                if (currentTrack && currentTrack.id === track.id && currentTrack.source === track.source) {
                                    usePlayerStore.getState().updateTrackLyrics({ lyric: lrc });
                                }
                            }
                        });
                    });
                }

                this.initHowl(assetUrl, track);
                return;
            }

            const allSources = useAudioSourceStore.getState().sources
            if (allSources.length === 0) {
                throw new Error("未配置任何音源，请在设置中添加音源")
            }

            const quality = useAudioSourceStore.getState().quality as AudioQuality

            // --- 预解析拦截 (Prefetch HIT) 逻辑：仅对最高优先级音源生效 ---
            if (track.source !== 'local') {
                const primarySource = allSources[0]
                const prefetchKey = this.getPrefetchKey(track, primarySource.id, quality)
                const prefetchPromise = this.prefetchPromises.get(prefetchKey)
                if (prefetchPromise) {
                    try {
                        console.log(`[PlayerService] 🎯 Prefetch HIT for track: "${track.name}"`);
                        const prefetchResult = await prefetchPromise

                        if (this.currentPlayRequestId !== requestId) {
                            console.log(`[PlayerService] 🛑 Cancelled prefetch HIT playback for obsolete track: ${track.name}`);
                            return;
                        }

                        this.prefetchPromises.delete(prefetchKey)

                        if (prefetchResult && prefetchResult.url) {
                            this.fallbackQualityUrl = prefetchResult.fallbackUrl
                            if (prefetchResult.lyrics) {
                                usePlayerStore.getState().updateTrackLyrics(prefetchResult.lyrics)
                            }

                            let finalUrl = prefetchResult.url
                            if (useCacheStore.getState().isCacheEnabled) {
                                try {
                                    if (await cacheService.isCached(track.id, track.source, quality)) {
                                        finalUrl = await cacheService.getCachedAudioBlobUrl(track.id, track.source, quality)
                                        console.log(`[PlayerService] 🛡️ 预解析命中本地缓存: ${track.name}`)
                                    } else {
                                        cacheService.downloadAndCache(track, finalUrl, quality)
                                    }
                                } catch (e) {
                                    console.error('[PlayerService] 缓存拦截失败:', e)
                                }
                            }

                            if (this.currentPlayRequestId !== requestId) return;

                            console.log(`[PlayerService] ⚡ Playing via prefetch: ${finalUrl}`);
                            this.initHowl(finalUrl, track)

                            this.triggerPrefetch()
                            return
                        }
                    } catch (e) {
                        console.warn(`[PlayerService] ⚠️ Prefetch hit but resolved with error, falling back to normal resolve:`, e)
                    }
                }
            }
            // --- 预解析拦截 (Prefetch HIT) 逻辑结束 ---

            // --- 按优先级遍历所有音源，依次尝试解析 URL ---
            let lastError: Error | null = null
            for (let i = 0; i < allSources.length; i++) {
                const configSource = allSources[i]

                if (this.currentPlayRequestId !== requestId) {
                    console.log(`[PlayerService] 🛑 Cancelled source iteration for obsolete track: ${track.name}`);
                    return;
                }

                try {
                    console.log(`[PlayerService] 🔄 Trying source #${i + 1}: "${configSource.name}" (${configSource.type})`)
                    const result = await this.resolveUrlFromSource(track, configSource, quality, requestId)

                    if (this.currentPlayRequestId !== requestId) {
                        console.log(`[PlayerService] 🛑 Cancelled after resolve for obsolete track: ${track.name}`);
                        return;
                    }

                    if (result) {
                        this.fallbackQualityUrl = result.fallbackUrl
                        if (result.lyrics) {
                            usePlayerStore.getState().updateTrackLyrics(result.lyrics)
                        }

                        let finalUrl = result.url
                        // 对酷狗资源的 https URL 强制降级为 http
                        if (track.source === 'kugou' && finalUrl.startsWith('https://')) {
                            finalUrl = finalUrl.replace('https://', 'http://')
                            console.log(`[PlayerService] 酷狗音频自动降级为 HTTP:`, finalUrl)
                        }

                        if (useCacheStore.getState().isCacheEnabled) {
                            try {
                                if (await cacheService.isCached(track.id, track.source, quality)) {
                                    finalUrl = await cacheService.getCachedAudioBlobUrl(track.id, track.source, quality)
                                    console.log(`[PlayerService] 🛡️ 命中本地缓存: ${track.name}`)
                                } else {
                                    cacheService.downloadAndCache(track, finalUrl, quality)
                                }
                            } catch (e) {
                                console.error('[PlayerService] 缓存拦截失败:', e)
                            }
                        }

                        if (this.currentPlayRequestId !== requestId) return;

                        console.log(`[PlayerService] ✅ Source #${i + 1} "${configSource.name}" success. Playing: ${track.name}`)
                        this.initHowl(finalUrl, track)

                        this.triggerPrefetch()
                        return
                    }
                } catch (e: any) {
                    lastError = e
                    console.warn(`[PlayerService] ❌ Source #${i + 1} "${configSource.name}" failed:`, e.message)
                    
                    let errorDetail = e.message
                    let rawJsonStr = ''
                    
                    if (e && typeof e === 'object') {
                        if (e.rawJson) {
                            try {
                                rawJsonStr = JSON.stringify(e.rawJson, null, 2)
                            } catch (_) {
                                rawJsonStr = String(e.rawJson)
                            }
                        } else if (e.rawText) {
                            rawJsonStr = e.rawText
                        }
                    }
                    
                    const displayMsg = rawJsonStr 
                        ? `音源"${configSource.name}"解析失败: ${errorDetail}\n\n原始响应:\n${rawJsonStr}`
                        : `音源"${configSource.name}"解析失败: ${errorDetail}`

                    // 额外使用 toast 告知用户为什么播放不了，展示具体报错原因与原始 JSON
                    toast.error(displayMsg, {
                        duration: 8000,
                        style: {
                            whiteSpace: 'pre-wrap',
                            maxHeight: '400px',
                            overflowY: 'auto'
                        }
                    })

                    // 告知用户当前音源失败，正在尝试下一个
                    if (i < allSources.length - 1) {
                        toast.warning(`音源"${configSource.name}"请求失败，正在尝试下一个音源...`)
                    }
                }
            }

            // 所有音源均失败
            const errorMsg = lastError?.message || "所有音源均无法解析此歌曲"
            throw new Error(`所有音源均请求失败: ${errorMsg}`)
        } catch (error: any) {
            console.error("[PlayerService] Play error:", error)
            const errorMsg = error?.message || "解析音频链接失败"
            usePlayerStore.getState().setPlayError(errorMsg)
            toast.error(`播放失败: ${errorMsg}`)
            usePlayerStore.getState().setIsLoading(false)
        }
    }

    /**
     * 对单个音源尝试解析播放 URL，成功则返回 { url, fallbackUrl, lyrics }，失败则抛异常
     */
    private async resolveUrlFromSource(
        track: Track,
        configSource: import('../models/audioSourceConfig').AudioSourceConfig,
        quality: AudioQuality,
        requestId: string
    ): Promise<{ url: string; fallbackUrl: string | null; lyrics?: any }> {
        let url = audioSourceService.buildPlaybackUrl(
            configSource,
            track.source as any,
            track.id,
            quality
        )

        if (!url) {
            throw new Error(`无法为 ${track.source} 构建播放 URL`)
        }

        let fallbackQualityUrl: string | null = null
        let lyricData: any = null

        // ─── LxMusic 音源 ───
        if (configSource.type === AudioSourceType.LxMusic) {
            await lxMusicRuntimeService.loadScript({
                name: configSource.name,
                version: configSource.version,
                script: configSource.scriptContent
            });

            if (this.currentPlayRequestId !== requestId) throw new Error('请求已过期')

            const lxSourceMap: Record<string, string> = {
                'netease': 'wy', 'qq': 'tx', 'kugou': 'kg', 'kuwo': 'kw'
            };
            const lxSource = lxSourceMap[track.source] || track.source;

            const realUrl = await lxMusicRuntimeService.getMusicUrl(lxSource, track.id, audioSourceService.getLxQuality(quality));
            if (this.currentPlayRequestId !== requestId) throw new Error('请求已过期')

            if (!realUrl) throw new Error('LxMusic Runtime 返回空 URL')
            url = realUrl

            // 异步并行加载歌词（不阻塞主流程）
            this.fetchAndApplyLyrics(track)

            return { url, fallbackUrl: null, lyrics: null }
        }

        // ─── OmniParse 网易云 (POST) ───
        if (configSource.type === AudioSourceType.OmniParse && track.source === 'netease') {
            const baseUrl = configSource.url.replace(/\/$/, '')
            const apiUrl = `${baseUrl}/song`

            const neteaseQualityMap: Record<string, string> = {
                '128k': 'standard', '320k': 'exhigh', 'flac': 'lossless', 'flac24bit': 'hires',
                'standard': 'standard', 'exhigh': 'exhigh', 'lossless': 'lossless', 'hires': 'hires',
                'jyeffect': 'jyeffect', 'sky': 'sky', 'jymaster': 'jymaster'
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
                    'X-API-Key': configSource.apiKey || ''
                },
                body: formData.toString()
            })

            if (this.currentPlayRequestId !== requestId) throw new Error('请求已过期')

            if (!response.ok) {
                const resText = await response.text().catch(() => "")
                let rawJson: any = null
                try {
                    rawJson = JSON.parse(resText)
                } catch (_) {}
                throw new AudioSourceError(`网易云音源响应异常 (HTTP ${response.status}): ${resText.slice(0, 80) || response.statusText}`, {
                    status: response.status,
                    rawText: resText,
                    rawJson: rawJson || undefined
                })
            }

            const result = await response.json()
            if (this.currentPlayRequestId !== requestId) throw new Error('请求已过期')

            if (result.status === 200 && result.url) {
                url = result.url
                if (result.lyric || result.yrc) {
                    lyricData = {
                        lyric: result.lyric || '', tlyric: result.tlyric || '',
                        yrc: result.yrc || '', ytlrc: result.ytlrc || ''
                    }
                }
            } else {
                throw new AudioSourceError(`网易云解析失败: ${result.msg || 'Unknown error'}`, {
                    rawJson: result
                })
            }

            return { url, fallbackUrl: null, lyrics: lyricData }
        }

        // ─── OmniParse GET (QQ / 酷狗 / 酷我) ───
        const omniParseGetSources = ['qq', 'kugou', 'kuwo'] as const
        if (configSource.type === AudioSourceType.OmniParse && (omniParseGetSources as readonly string[]).includes(track.source)) {
            const response = await fetch(url, {
                headers: { 'X-API-Key': configSource.apiKey || '' }
            })

            if (this.currentPlayRequestId !== requestId) throw new Error('请求已过期')
            if (!response.ok) {
                const resText = await response.text().catch(() => "")
                let rawJson: any = null
                try {
                    rawJson = JSON.parse(resText)
                } catch (_) {}
                throw new AudioSourceError(`音源服务器解析失败 (HTTP ${response.status}): ${resText.slice(0, 80) || response.statusText}`, {
                    status: response.status,
                    rawText: resText,
                    rawJson: rawJson || undefined
                })
            }

            const result = await response.json()
            if (this.currentPlayRequestId !== requestId) throw new Error('请求已过期')

            if (result.status === 200) {
                let extractedUrl = ''

                if (track.source === 'qq') {
                    const musicUrls = result.music_urls || {}
                    extractedUrl = musicUrls.flac?.url || musicUrls['320']?.url || musicUrls['128']?.url || ''
                    const backupUrl = musicUrls['320']?.url || musicUrls['128']?.url || ''
                    if (backupUrl && backupUrl !== extractedUrl) {
                        fallbackQualityUrl = backupUrl
                    }
                } else {
                    const songData = result.song || result
                    extractedUrl = songData.url || ''
                }

                if (!extractedUrl) {
                    throw new AudioSourceError(`${track.source} 解析成功但未返回播放链接`, {
                        rawJson: result
                    })
                }
                url = extractedUrl

                // 异步并行加载歌词
                this.fetchAndApplyLyrics(track)

                return { url, fallbackUrl: fallbackQualityUrl, lyrics: null }
            } else {
                throw new AudioSourceError(`${track.source} 解析失败: ${result.msg || 'Unknown error'}`, {
                    rawJson: result
                })
            }
        }

        // ─── TuneHub 或其他类型：直接使用构建的 URL ───
        return { url, fallbackUrl: null, lyrics: null }
    }

    /**
     * 异步并行加载歌词并应用到当前曲目（不阻塞播放流程）
     */
    private fetchAndApplyLyrics(track: Track) {
        if (track.source === 'netease') {
            const lyricUrl = `${urlService.baseUrl}/lyrics/netease?id=${track.id}`;
            fetch(lyricUrl).then(res => res.json()).then(lyricResult => {
                const lyricData = lyricResult?.data || lyricResult;
                if (lyricData?.lyric || lyricData?.yrc) {
                    const currentTrack = usePlayerStore.getState().currentTrack;
                    if (currentTrack && currentTrack.id === track.id) {
                        usePlayerStore.getState().updateTrackLyrics({
                            lyric: lyricData.lyric || '', tlyric: lyricData.tlyric || '',
                            yrc: lyricData.yrc || '', ytlrc: lyricData.ytlrc || '',
                        });
                    }
                }
            }).catch(e => console.warn('[PlayerService] Failed to fetch Netease lyrics:', e));
        } else if (track.source === 'qq') {
            const lyricUrl = `${urlService.baseUrl}/lyrics/qq?id=${track.id}`;
            fetch(lyricUrl).then(res => res.json()).then(lyricResult => {
                const lyricData = lyricResult?.data || lyricResult;
                if (lyricData?.lyric || lyricData?.qrc) {
                    const currentTrack = usePlayerStore.getState().currentTrack;
                    if (currentTrack && currentTrack.id === track.id) {
                        usePlayerStore.getState().updateTrackLyrics({
                            lyric: lyricData.lyric || '', tlyric: lyricData.tlyric || '',
                            yrc: lyricData.qrc || '', ytlrc: lyricData.qrcTrans || '',
                        });
                    }
                }
            }).catch(e => console.warn('[PlayerService] Failed to fetch QQ lyrics:', e));
        } else if (track.source === 'kugou') {
            const hash = String(track.id).split(':')[0];
            if (hash) {
                const lyricUrl = `${urlService.baseUrl}/lyrics/kugou?hash=${hash}`;
                fetch(lyricUrl).then(res => res.json()).then(lyricResult => {
                    const lyricData = lyricResult?.data || lyricResult;
                    if (lyricData?.lyric) {
                        const currentTrack = usePlayerStore.getState().currentTrack;
                        if (currentTrack && currentTrack.id === track.id) {
                            usePlayerStore.getState().updateTrackLyrics({
                                lyric: lyricData.lyric || '', tlyric: lyricData.tlyric || '',
                            });
                        }
                    }
                }).catch(e => console.warn('[PlayerService] Failed to fetch Kugou lyrics:', e));
            }
        }
    }

    private initHowl(url: string, track: Track) {
        // 双保验证：确保最终初始化的歌曲严格匹配 Zustand 中的当前曲目，防止极端延迟回调引发的进度冲突
        const currentTrack = usePlayerStore.getState().currentTrack;
        if (!currentTrack || currentTrack.id !== track.id || currentTrack.source !== track.source) {
            console.warn(`[PlayerService] ⚠️ Aborted obsolete Howl initialization for: "${track.name}"`);
            return;
        }

        this.currentPlayingUrl = url
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
        const store = usePlayerStore.getState()
        const { queue, repeatMode } = store

        if (queue.length === 0) return

        // 🔀 随机播放模式：若有提前内定且已预解析完成的随机歌，且它还在当前队列中，直接拦截播放它！
        if (repeatMode === RepeatMode.Shuffle && this.nextRandomTrack) {
            const isStillInQueue = queue.some(t => t.id === this.nextRandomTrack!.id && t.source === this.nextRandomTrack!.source)
            if (isStillInQueue) {
                const trackToPlay = this.nextRandomTrack

                // 将下二首晋升为下一首，重置下二首，平移内定指针
                this.nextRandomTrack = this.nextRandomTrack2
                this.nextRandomTrack2 = null

                console.log(`[PlayerService] 🔀 Shuffle Next Play (內定命中): "${trackToPlay.name}"`)

                // 更新 Zustand 状态并触发播放
                store.setCurrentTrack(trackToPlay)
                this.playTrack(trackToPlay)
                return
            }
        }

        // 🔁 其他模式或退化情况：正常走原有播放顺序逻辑
        store.playNext()
        const nextTrack = store.currentTrack
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

    private syncThumbbarState(isPlaying: boolean) {
        try {
            if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
                invoke('update_thumbbar_playing_state', { isPlaying })
            }
        } catch (e) {
            // Ignore on non-Windows or non-Tauri environments
        }
    }

    /**
     * 独立预载歌词的方法，支持网易云、QQ和酷狗
     */
    private async fetchLyricsOnly(track: Track): Promise<any> {
        try {
            if (track.source === 'netease') {
                const lyricUrl = `${urlService.baseUrl}/lyrics/netease?id=${track.id}`;
                const res = await fetch(lyricUrl);
                const lyricResult = await res.json();
                const lyricData = lyricResult?.data || lyricResult;
                if (lyricData?.lyric || lyricData?.yrc) {
                    return {
                        lyric: lyricData.lyric || '',
                        tlyric: lyricData.tlyric || '',
                        yrc: lyricData.yrc || '',
                        ytlrc: lyricData.ytlrc || '',
                    };
                }
            } else if (track.source === 'qq') {
                const lyricUrl = `${urlService.baseUrl}/lyrics/qq?id=${track.id}`;
                const res = await fetch(lyricUrl);
                const lyricResult = await res.json();
                const lyricData = lyricResult?.data || lyricResult;
                if (lyricData?.lyric || lyricData?.qrc) {
                    return {
                        lyric: lyricData.lyric || '',
                        tlyric: lyricData.tlyric || '',
                        yrc: lyricData.qrc || '',
                        ytlrc: lyricData.qrcTrans || '',
                    };
                }
            } else if (track.source === 'kugou') {
                const kugouHash = String(track.id).split(':')[0];
                if (kugouHash) {
                    const lyricUrl = `${urlService.baseUrl}/lyrics/kugou?hash=${kugouHash}`;
                    const res = await fetch(lyricUrl);
                    const lyricResult = await res.json();
                    const lyricData = lyricResult?.data || lyricResult;
                    if (lyricData?.lyric) {
                        return {
                            lyric: lyricData.lyric || '',
                            tlyric: lyricData.tlyric || '',
                        };
                    }
                }
            }
        } catch (e) {
            console.warn(`[PlayerService] Failed to fetch lyrics during prefetch for ${track.name}:`, e);
        }
        return null;
    }

    /**
     * 对单个在线歌曲发起异步预解析，并存储在 prefetchPromises 中
     */
    private prefetchTrack(track: Track, activeConfigSource: any, quality: string) {
        if (track.source === 'local') return; // 本地音乐无需预解析

        const key = this.getPrefetchKey(track, activeConfigSource.id, quality);
        if (this.prefetchPromises.has(key)) {
            return; // 相同的预解析任务正在进行或已缓存
        }

        console.log(`[PlayerService] 🟢 Start prefetching: "${track.name}" (${track.source}) using ${activeConfigSource.name} (${quality})`);

        const promise = (async () => {
            let url = audioSourceService.buildPlaybackUrl(
                activeConfigSource,
                track.source as any,
                track.id,
                quality as any
            );

            if (!url) {
                throw new Error("Failed to build playback URL");
            }

            let fallbackQualityUrl: string | null = null;
            let lyricData: any = null;

            // 1. 洛雪音源预解析逻辑
            if (activeConfigSource.type === AudioSourceType.LxMusic) {
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
                const realUrl = await lxMusicRuntimeService.getMusicUrl(lxSource, track.id, audioSourceService.getLxQuality(quality as any));
                if (!realUrl) {
                    throw new Error("LxMusic Runtime returned empty URL");
                }
                url = realUrl;

                // 并行预取歌词
                lyricData = await this.fetchLyricsOnly(track);
            }
            // 2. OmniParse 且是网易云预解析逻辑
            else if (activeConfigSource.type === AudioSourceType.OmniParse && track.source === 'netease') {
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

                if (!response.ok) {
                    throw new Error(`Netease API HTTP ${response.status}`);
                }

                const result = await response.json()
                if (result.status === 200 && result.url) {
                    url = result.url
                    if (result.lyric || result.yrc) {
                        lyricData = {
                            lyric: result.lyric || '',
                            yrc: result.yrc || '',
                            tlyric: result.tlyric || '',
                            ytlrc: result.ytlrc || ''
                        };
                    }
                } else {
                    throw new Error(result.msg || 'Netease API status error');
                }
            }
            // 3. OmniParse 且是 QQ / Kugou / Kuwo 预解析逻辑
            else if (activeConfigSource.type === AudioSourceType.OmniParse && ['qq', 'kugou', 'kuwo'].includes(track.source)) {
                const response = await fetch(url, {
                    headers: {
                        'X-API-Key': activeConfigSource.apiKey || ''
                    }
                })

                if (!response.ok) {
                    throw new Error(`API HTTP ${response.status}`);
                }

                const result = await response.json()
                if (result.status === 200) {
                    let extractedUrl = ''

                    if (track.source === 'qq') {
                        const musicUrls = result.music_urls || {}
                        extractedUrl = musicUrls.flac?.url || musicUrls['320']?.url || musicUrls['128']?.url || ''

                        const backupUrl = musicUrls['320']?.url || musicUrls['128']?.url || ''
                        if (backupUrl && backupUrl !== extractedUrl) {
                            fallbackQualityUrl = backupUrl
                        }
                    } else if (track.source === 'kugou') {
                        const songData = result.song || result
                        extractedUrl = songData.url || ''
                    } else {
                        const songData = result.song || result
                        extractedUrl = songData.url || ''
                    }

                    if (extractedUrl) {
                        url = extractedUrl
                    } else {
                        throw new Error("No playback URL in response");
                    }

                    // 并行加载歌词
                    lyricData = await this.fetchLyricsOnly(track);
                } else {
                    throw new Error(result.msg || 'API status error');
                }
            }

            // 对酷狗资源的 https URL 强制降级为 http
            if (track.source === 'kugou' && url.startsWith('https://')) {
                url = url.replace('https://', 'http://');
            }

            console.log(`[PlayerService] 🔵 Prefetch SUCCESS for: "${track.name}". Link generated.`);
            return {
                url,
                fallbackUrl: fallbackQualityUrl,
                lyrics: lyricData
            };
        })();

        // 捕捉错误，并在错误时清理对应的 Key，以便后续能重新解析
        promise.catch(err => {
            console.warn(`[PlayerService] 🔴 Prefetch FAILED for "${track.name}":`, err);
            this.prefetchPromises.delete(key);
        });

        this.prefetchPromises.set(key, promise);

        // 控制缓存的大小，防止预解析 Map 占用过多内存（最多保留最新 6 个任务）
        if (this.prefetchPromises.size > 6) {
            const firstKey = this.prefetchPromises.keys().next().value;
            if (firstKey) {
                this.prefetchPromises.delete(firstKey);
            }
        }
    }

    /**
     * 自动触发接下来 1-2 首歌的预解析调度器
     */
    private triggerPrefetch() {
        try {
            const store = usePlayerStore.getState();
            const { queue, currentTrack, repeatMode } = store;
            if (queue.length === 0 || !currentTrack) return;

            const allSources = useAudioSourceStore.getState().sources;
            const activeConfigSource = allSources.length > 0 ? allSources[0] : null;
            if (!activeConfigSource) return;
            const quality = useAudioSourceStore.getState().quality as AudioQuality;

            const currentIndex = queue.findIndex(t => t.id === currentTrack.id && t.source === currentTrack.source);
            if (currentIndex === -1) return;

            const tracksToPrefetch: Track[] = [];

            if (repeatMode === RepeatMode.Shuffle) {
                // 🔀 随机播放模式：提前“内定”接下来的随机歌，这样切歌时才能 100% 命中预解析
                // 1. 验证或生成第一首内定随机歌
                const isNext1Valid = this.nextRandomTrack && queue.some(t => t.id === this.nextRandomTrack!.id && t.source === this.nextRandomTrack!.source);
                if (!isNext1Valid) {
                    this.nextRandomTrack = this.getRandomTrackExcluding(queue, currentTrack);
                }

                // 2. 验证或生成第二首内定随机歌 (避免与当前歌、第一首随机歌重复)
                const isNext2Valid = this.nextRandomTrack2 && queue.some(t => t.id === this.nextRandomTrack2!.id && t.source === this.nextRandomTrack2!.source);
                if (!isNext2Valid) {
                    this.nextRandomTrack2 = this.getRandomTrackExcluding(queue, currentTrack, this.nextRandomTrack || undefined);
                }

                if (this.nextRandomTrack) tracksToPrefetch.push(this.nextRandomTrack);
                if (this.nextRandomTrack2) tracksToPrefetch.push(this.nextRandomTrack2);

                console.log(`[PlayerService] 🔀 Shuffle Mode Prefetch - 内定下一首: "${this.nextRandomTrack?.name}", 下二首: "${this.nextRandomTrack2?.name}"`);
            } else {
                // 🔁 顺序/循环播放模式：根据物理顺序预载接下来的 1~2 首歌
                const next1 = queue[(currentIndex + 1) % queue.length];
                if (next1 && (next1.id !== currentTrack.id || next1.source !== currentTrack.source)) {
                    tracksToPrefetch.push(next1);
                }

                const next2 = queue[(currentIndex + 2) % queue.length];
                if (next2 &&
                    (next2.id !== currentTrack.id || next2.source !== currentTrack.source) &&
                    (next2.id !== next1?.id || next2.source !== next1?.source)
                ) {
                    tracksToPrefetch.push(next2);
                }
            }

            // 发起后台异步并发预解析
            tracksToPrefetch.forEach(track => {
                this.prefetchTrack(track, activeConfigSource, quality);
            });
        } catch (e) {
            console.warn("[PlayerService] Trigger prefetch failed:", e);
        }
    }

    /**
     * 辅助函数：从歌曲队列中随机挑选一首，并安全过滤掉指定排除的歌曲
     */
    private getRandomTrackExcluding(queue: Track[], ...excludeTracks: (Track | undefined)[]): Track | null {
        if (queue.length === 0) return null;

        const filtered = queue.filter(track => {
            return !excludeTracks.some(exclude =>
                exclude && exclude.id === track.id && exclude.source === track.source
            );
        });

        // 如果全部被排除了（比如队列总共只有 1 首歌且已被排除），则退化为直接从原队列中抽取
        const listToSelect = filtered.length > 0 ? filtered : queue;
        const randomIndex = Math.floor(Math.random() * listToSelect.length);
        return listToSelect[randomIndex];
    }

    public cleanup() {
        // Cleanup logic
        androidMediaNotificationService.hide()
    }
}

export const playerService = PlayerService.getInstance()