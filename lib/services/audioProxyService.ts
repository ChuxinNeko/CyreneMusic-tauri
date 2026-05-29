import { invoke } from '@tauri-apps/api/core'

/**
 * 音频代理服务：将需要绕过防盗链的音频 URL 转为本地代理 URL。
 * 当前仅用于汽水音乐（抖音 CDN）。
 */
class AudioProxyService {
    private static instance: AudioProxyService
    private proxyPort: number | null = null

    private constructor() {}

    public static getInstance(): AudioProxyService {
        if (!AudioProxyService.instance) {
            AudioProxyService.instance = new AudioProxyService()
        }
        return AudioProxyService.instance
    }

    /** 获取 Rust 代理服务器端口（首次调用时从后端获取并缓存） */
    private async getPort(): Promise<number> {
        if (this.proxyPort !== null) return this.proxyPort
        try {
            this.proxyPort = await invoke<number>('get_audio_proxy_port')
            console.log(`[AudioProxyService] Proxy port: ${this.proxyPort}`)
            return this.proxyPort
        } catch (e) {
            console.error('[AudioProxyService] Failed to get proxy port:', e)
            throw e
        }
    }

    /**
     * 判断 URL 是否需要走代理（汽水音乐 / 抖音 CDN 域名）
     */
    public shouldProxy(url: string): boolean {
        try {
            const hostname = new URL(url).hostname
            return (
                hostname.includes('douyinvod.com') ||
                hostname.includes('douyin.com') ||
                hostname.includes('bytedance.com') ||
                hostname.includes('bytecdn.cn')
            )
        } catch {
            return false
        }
    }

    /**
     * 将原始 URL 包装为本地代理 URL
     * 格式：http://127.0.0.1:<PORT>/proxy?url=<encodeURIComponent(url)>
     */
    public async wrapUrl(url: string): Promise<string> {
        const port = await this.getPort()
        return `http://127.0.0.1:${port}/proxy?url=${encodeURIComponent(url)}`
    }
}

export const audioProxyService = AudioProxyService.getInstance()
