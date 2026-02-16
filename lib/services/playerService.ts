"use client"

import { audioSourceService, AudioQuality } from "./audioSourceService"
import { AudioSourceType } from "../models/audioSourceConfig"
import { usePlayerStore } from "../store/usePlayerStore"
import { useAudioSourceStore } from "../store/useAudioSourceStore"
import { Track } from "../models/track"

class PlayerService {
    private static instance: PlayerService
    private audio: HTMLAudioElement | null = null
    private progressInterval: any = null

    private constructor() {
        if (typeof window !== "undefined") {
            this.audio = new Audio()
            this.setupInitialVolume()
            this.setupEvents()
        }
    }

    public static getInstance(): PlayerService {
        if (!PlayerService.instance) {
            PlayerService.instance = new PlayerService()
        }
        return PlayerService.instance
    }

    private setupInitialVolume() {
        if (!this.audio) return
        const volume = usePlayerStore.getState().volume
        this.audio.volume = volume
    }

    private setupEvents() {
        if (!this.audio) return

        this.audio.onplay = () => {
            usePlayerStore.getState().setIsPlaying(true)
            this.startProgressTimer()
        }

        this.audio.onpause = () => {
            usePlayerStore.getState().setIsPlaying(false)
            this.stopProgressTimer()
        }

        this.audio.onwaiting = () => {
            usePlayerStore.getState().setIsLoading(true)
        }

        this.audio.oncanplay = () => {
            usePlayerStore.getState().setIsLoading(false)
        }

        this.audio.onloadedmetadata = () => {
            if (this.audio) {
                usePlayerStore.getState().setDuration(this.audio.duration)
            }
        }

        this.audio.onended = () => {
            usePlayerStore.getState().playNext()
            const nextTrack = usePlayerStore.getState().currentTrack
            if (nextTrack) {
                this.playTrack(nextTrack)
            }
        }

        this.audio.onerror = (e) => {
            console.error("[PlayerService] Audio error:", e)
            usePlayerStore.getState().setIsLoading(false)
            usePlayerStore.getState().setIsPlaying(false)
        }
    }

    private startProgressTimer() {
        this.stopProgressTimer()
        this.progressInterval = setInterval(() => {
            if (this.audio) {
                const currentTime = this.audio.currentTime
                const duration = this.audio.duration
                if (duration) {
                    usePlayerStore.getState().setCurrentTime(currentTime)
                    usePlayerStore.getState().setProgress(currentTime / duration)
                }
            }
        }, 500)
    }

    private stopProgressTimer() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval)
            this.progressInterval = null
        }
    }

    public async playTrack(track: Track) {
        if (!this.audio) return

        try {
            usePlayerStore.getState().setIsLoading(true)
            usePlayerStore.getState().setCurrentTrack(track)

            // 获取当前活跃的音源配置
            const activeConfigSource = useAudioSourceStore.getState().getActiveSource()
            if (!activeConfigSource) {
                throw new Error("No active audio source configured")
            }

            // 构建播放 URL
            const quality = AudioQuality.ExHigh // 默认高音质
            let url = audioSourceService.buildPlaybackUrl(
                activeConfigSource,
                track.source as any,
                track.id,
                quality
            )

            if (!url) {
                throw new Error(`Failed to build playback URL for source: ${track.source}`)
            }

            // 特殊处理 OmniParse 网易云：需要 POST 请求获取真实地址 (Form Data + X-API-Key)
            if (activeConfigSource.type === AudioSourceType.OmniParse && track.source === 'netease') {
                const baseUrl = activeConfigSource.url.replace(/\/$/, '');
                const apiUrl = `${baseUrl}/song`;

                console.log(`[PlayerService] Fetching Netease real URL via Form POST: ${apiUrl}`);

                const formData = new URLSearchParams();
                formData.append('ids', track.id.toString());
                formData.append('url', ''); // 保持空，根据 curl 示例
                formData.append('level', quality);
                formData.append('type', 'json');

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-API-Key': activeConfigSource.apiKey || ''
                    },
                    body: formData.toString()
                });

                const result = await response.json();
                // 示例显示 url 就在根路径上
                if (result.status === 200 && result.url) {
                    url = result.url;
                    // 如果有歌词，可以在此处理或存入 store
                    console.log(`[PlayerService] Successfully fetched real URL and metadata for: ${result.name}`);
                } else {
                    throw new Error(`Failed to fetch Netease real URL: ${result.msg || 'Unknown error'}`);
                }
            }

            console.log(`[PlayerService] Playing: ${track.name} from ${url}`)

            this.audio.src = url
            await this.audio.play()
        } catch (error) {
            console.error("[PlayerService] Play error:", error)
            usePlayerStore.getState().setIsLoading(false)
            // TODO: 这里可以实现自动跳过或降级逻辑
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
        if (!this.audio) return
        if (this.audio.paused) {
            this.audio.play()
        } else {
            this.audio.pause()
        }
    }

    public seek(time: number) {
        if (this.audio) {
            this.audio.currentTime = time
            usePlayerStore.getState().setCurrentTime(time)
        }
    }

    public setVolume(volume: number) {
        if (this.audio) {
            this.audio.volume = volume
            usePlayerStore.getState().setVolume(volume)
        }
    }
}

export const playerService = PlayerService.getInstance()
