import { Track } from "../models/track"
import { urlService } from "./urlService"
import { MusicSource } from "./audioSourceService"

export interface Toplist {
    id: number
    name: string
    coverImgUrl: string
    description: string
    tracks: Array<{
        id: string | number
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

export interface DiscoveryTag {
    id: number
    name: string
    category: number
}

export interface DiscoveryPlaylist {
    id: number
    name: string
    coverImgUrl: string
    creatorNickname: string
    playCount: number
    trackCount: number
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

    private getCacheKey(key: string, token?: string) {
        return token ? `cyrene_cache_${key}_${token}` : `cyrene_cache_${key}`
    }

    private async getWithCache<T>(key: string, fetcher: () => Promise<T>, forceRefresh: boolean = false): Promise<T | null> {
        const CACHE_KEY = key
        const CACHE_EXPIRY_KEY = `${key}_expiry`

        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(CACHE_KEY)
                const expiry = localStorage.getItem(CACHE_EXPIRY_KEY)
                if (cached && expiry && Date.now() < Number(expiry)) {
                    return JSON.parse(cached) as T
                }
            } catch (e) {
                console.error("[DiscoveryService] Cache read failed:", e)
            }
        }

        const data = await fetcher()
        
        if (data) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(data))
                const nextMidnight = new Date()
                nextMidnight.setHours(24, 0, 0, 0)
                localStorage.setItem(CACHE_EXPIRY_KEY, nextMidnight.getTime().toString())
            } catch (e) {
                console.error("[DiscoveryService] Cache write failed:", e)
            }
        }
        
        return data
    }

    public async getToplists(forceRefresh: boolean = false): Promise<Toplist[]> {
        const fetcher = async () => {
            try {
                const response = await fetch(`${urlService.baseUrl}/toplists`)
                const result = await response.json()
                return result.toplists || []
            } catch (e) {
                console.error("[DiscoveryService] getToplists fetch failed:", e)
                return []
            }
        }
        const data = await this.getWithCache<Toplist[]>(this.getCacheKey('toplists'), fetcher, forceRefresh)
        return data || []
    }

    public async getRecommendForYou(token: string, forceRefresh: boolean = false): Promise<RecommendData | null> {
        const fetcher = async () => {
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
                console.error("[DiscoveryService] getRecommendForYou fetch failed:", e)
                return null
            }
        }
        return this.getWithCache<RecommendData | null>(this.getCacheKey('recommend_for_you', token), fetcher, forceRefresh)
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

    public async getDiscoverTags(): Promise<DiscoveryTag[]> {
        try {
            const response = await fetch(`${urlService.baseUrl}/netease/playlist/highquality/tags`)
            const result = await response.json()
            if (result.status === 200) {
                return result.tags || []
            }
            return []
        } catch (e) {
            console.error("[DiscoveryService] getDiscoverTags failed:", e)
            return []
        }
    }

    public async getDiscoverPlaylists(cat: string = "全部歌单", forceRefresh: boolean = false): Promise<DiscoveryPlaylist[]> {
        const fetcher = async () => {
            try {
                const encodedCat = encodeURIComponent(cat)
                const response = await fetch(`${urlService.baseUrl}/netease/top/playlist?cat=${encodedCat}`)
                const result = await response.json()
                if (result.status === 200) {
                    const list = (result.playlists as any[] || [])
                    return list.map(item => ({
                        id: item.id,
                        name: item.name,
                        coverImgUrl: item.coverImgUrl,
                        creatorNickname: item.creator.nickname,
                        playCount: item.playCount,
                        trackCount: item.trackCount
                    }))
                }
                return []
            } catch (e) {
                console.error("[DiscoveryService] getDiscoverPlaylists fetch failed:", e)
                return []
            }
        }
        const data = await this.getWithCache<DiscoveryPlaylist[]>(this.getCacheKey(`discover_playlists_${cat}`), fetcher, forceRefresh)
        return data || []
    }

    public convertToTrack(song: any): Track {
        const albumData = (song.al || song.album || {})
        const artistsData = (song.ar || song.artists || [])

        let artists = ""
        if (Array.isArray(artistsData)) {
            artists = artistsData.map((a: any) => (typeof a === "string" ? a : a.name)).join(" / ")
        } else {
            artists = String(artistsData)
        }

        let album = ""
        let picUrl = song.picUrl || ""
        if (typeof albumData === "string") {
            album = albumData
        } else {
            album = albumData.name || ""
            if (albumData.picUrl) picUrl = albumData.picUrl
        }

        return {
            id: song.id,
            name: song.name,
            artists: artists,
            album: album,
            picUrl: picUrl,
            source: song.source || MusicSource.Netease,
            duration: (song.dt || song.duration || 0) / (song.dt ? 1000 : 1)
        }
    }
}

export const discoveryService = DiscoveryService.getInstance()
