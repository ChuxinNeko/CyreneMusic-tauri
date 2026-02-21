import { Track } from "../models/track"
import { urlService } from "./urlService"
import { MusicSource } from "./audioSourceService"

export interface Toplist {
    id: number
    name: string
    coverImgUrl: string
    description: string
    tracks: Array<{
        id: number
        name: string
        artists: string
        album: string
        picUrl: string
        duration?: number
    }>
}

export interface RecommendData {
    dailySongs: any[]
    fm: any[]
    dailyPlaylists: any[]
    personalizedPlaylists: any[]
    radarPlaylists: any[]
    personalizedNewsongs: any[]
}

export interface PlaylistDetail extends Toplist {
    playCount: number
    creator: string
    trackCount: number
    createTime: number
    updateTime: number
    tags: string[]
}

class DiscoveryService {
    private static instance: DiscoveryService

    private constructor() { }

    public static getInstance(): DiscoveryService {
        if (!DiscoveryService.instance) {
            DiscoveryService.instance = new DiscoveryService()
        }
        return DiscoveryService.instance
    }

    private getHeaders(token?: string) {
        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        }
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }
        return headers
    }

    public async getToplists(): Promise<Toplist[]> {
        try {
            const response = await fetch(`${urlService.baseUrl}/toplists`)
            const result = await response.json()
            return result.toplists || []
        } catch (e) {
            console.error("[DiscoveryService] getToplists failed:", e)
            return []
        }
    }

    public async getRecommendForYou(token: string): Promise<RecommendData | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/recommend/for_you`, {
                headers: this.getHeaders(token)
            })
            const result = await response.json()
            if (result.success) {
                return result.data
            }
            return null
        } catch (e) {
            console.error("[DiscoveryService] getRecommendForYou failed:", e)
            return null
        }
    }

    public async getPlaylistDetail(id: string | number, limit: number = 200, token?: string): Promise<PlaylistDetail | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlist?id=${id}&limit=${limit}`, {
                headers: this.getHeaders(token)
            })
            const result = await response.json()
            if (result.success) {
                return result.data.playlist
            }
            return null
        } catch (e) {
            console.error("[DiscoveryService] getPlaylistDetail failed:", e)
            return null
        }
    }

    public convertToTrack(song: any): Track {
        const album = (song.al || song.album || {})
        const artists = (song.ar || song.artists || []) as any[]
        return {
            id: song.id,
            name: song.name,
            artists: artists.map(a => a.name).join(' / '),
            album: album.name || '',
            picUrl: album.picUrl || '',
            source: MusicSource.Netease,
            duration: (song.dt || song.duration || 0) / 1000
        }
    }
}

export const discoveryService = DiscoveryService.getInstance()
