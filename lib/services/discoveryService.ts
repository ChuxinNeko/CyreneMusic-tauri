import { Track } from "../models/track"
import { urlService } from "./urlService"
import { MusicSource } from "./audioSourceService"
import type { ToplistSource, RecommendSource } from "../store/useLayoutStore"
import { apiFetch } from "./apiClient"

export interface Toplist {
    id: number
    name: string
    coverImgUrl: string
    description: string
    source?: MusicSource
    tracks: Array<{
        id: string | number
        /** QQ 音乐特有：songmid，用于获取播放链接 */
        mid?: string
        name: string
        artists: string
        album: string
        picUrl: string
        duration?: number
        source?: MusicSource
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

    public async getToplists(forceRefresh: boolean = false, source: ToplistSource = 'netease'): Promise<Toplist[]> {
        const isQQ = source === 'qq'
        const fetcher = async () => {
            try {
                const endpoint = isQQ
                    ? `${urlService.baseUrl}/qq/toplists`
                    : `${urlService.baseUrl}/toplists`
                const response = await fetch(endpoint)
                const result = await response.json()
                let toplists = result.toplists || []
                // QQ 榜单歌曲 id 默认是数字 songid，需要改用可播放的 songmid（字段名为 mid）
                if (isQQ) {
                    toplists = (toplists as Toplist[]).map(list => ({
                        ...list,
                        // 给榜单本身打上来源标记，便于后续区分
                        source: MusicSource.QQ,
                        tracks: list.tracks.map(t => ({
                            ...t,
                            // mid 是 songmid（字母数字混合），作为 Track.id 才能被 /qq/song 正确解析
                            id: (t as any).mid || t.id,
                            source: MusicSource.QQ,
                        }))
                    }))
                }
                return toplists
            } catch (e) {
                console.error("[DiscoveryService] getToplists fetch failed:", e)
                return []
            }
        }
        const cacheKey = this.getCacheKey(isQQ ? 'toplists_qq' : 'toplists')
        const data = await this.getWithCache<Toplist[]>(cacheKey, fetcher, forceRefresh)
        return data || []
    }

    public async getRecommendForYou(token: string, forceRefresh: boolean = false, source: RecommendSource = 'netease'): Promise<RecommendData | null> {
        const isQQ = source === 'qq'
        const endpoint = isQQ ? '/qq/recommend/for_you' : '/recommend/for_you'
        const cacheKey = isQQ ? 'recommend_for_you_qq' : 'recommend_for_you'
        const fetcher = async () => {
            try {
                const response = await apiFetch(`${urlService.baseUrl}${endpoint}`, {
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
        return this.getWithCache<RecommendData | null>(this.getCacheKey(cacheKey, token), fetcher, forceRefresh)
    }

    /**
     * 获取歌单/榜单详情。
     * @param source 'netease' | 'qq'：数据来源平台
     * @param qqKind 'toplist' | 'playlist'：仅当 source='qq' 时生效。
     *        - 'toplist'（默认）：id 是榜单 topId（如 3/4/26），走 /qq/toplist/:topId
     *        - 'playlist'：id 是歌单 dissid/content_id（如推荐歌单），走 /qq/playlist?id=
     */
    public async getPlaylistDetail(id: string | number, limit: number = 200, token?: string, source: ToplistSource = 'netease', qqKind: 'toplist' | 'playlist' = 'toplist'): Promise<PlaylistDetail | null> {
        if (source === 'qq') {
            // QQ 歌单详情走 /qq/playlist?id=<dissid>，后端返回结构（data.playlist）与网易云一致
            if (qqKind === 'playlist') {
                try {
                    const response = await fetch(`${urlService.baseUrl}/qq/playlist?id=${id}&limit=${limit}`)
                    const result = await response.json()
                    if (result.success) {
                        return result.data.playlist
                    }
                    return null
                } catch (e) {
                    console.error("[DiscoveryService] getQQPlaylistDetail failed:", e)
                    return null
                }
            }
            // QQ 榜单「查看全部」走 /qq/toplist/:topId，返回扁平结构，需适配为 PlaylistDetail
            try {
                const response = await fetch(`${urlService.baseUrl}/qq/toplist/${id}?limit=${limit}`)
                const result = await response.json()
                if (result.status === 200) {
                    const tracks = (result.tracks || []).map((t: any) => ({
                        ...t,
                        // mid 是 songmid（可播放），作为 id 供 convertToTrack 使用
                        id: t.mid || t.id,
                        source: MusicSource.QQ
                    }))
                    return {
                        id: result.id,
                        name: result.name,
                        coverImgUrl: result.coverImgUrl,
                        description: result.description || '',
                        creator: result.creator || 'QQ音乐',
                        trackCount: result.trackCount || tracks.length,
                        playCount: result.playCount || 0,
                        createTime: result.createTime || 0,
                        updateTime: result.updateTime || 0,
                        tags: result.tags || [],
                        source: MusicSource.QQ,
                        tracks
                    }
                }
                return null
            } catch (e) {
                console.error("[DiscoveryService] getQQToplistDetail failed:", e)
                return null
            }
        }

        try {
            const response = await apiFetch(`${urlService.baseUrl}/playlist?id=${id}&limit=${limit}`, {
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

        // QQ 音乐歌曲：id 必须用 songmid（非数字），否则后端会按数字 songid 处理导致播放失败
        const isQQ = song.source === MusicSource.QQ || !!song.mid
        if (isQQ) {
            return {
                id: song.mid || song.id,
                name: song.name,
                artists: artists,
                album: album,
                picUrl: picUrl,
                source: MusicSource.QQ,
                duration: (song.dt || song.duration || 0) / (song.dt ? 1000 : 1)
            }
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

    public async getPlaylistComments(
        playlistId: string | number,
        limit: number = 20,
        offset: number = 0,
        before: number = 0,
        /** 排序方式：0=按时间(默认)，1=按热度 */
        sortType: 0 | 1 = 0,
    ): Promise<{ code: number; total: number; more: boolean; moreHot: boolean; hotComments: any[]; comments: any[] } | null> {
        try {
            const params = new URLSearchParams({
                id: String(playlistId),
                limit: String(limit),
                offset: String(offset),
                before: String(before),
                sortType: String(sortType),
            })
            const response = await fetch(`${urlService.baseUrl}/comment/playlist?${params}`)
            const result = await response.json()
            if (result.status === 200) {
                return {
                    code: result.code,
                    total: result.total ?? 0,
                    more: !!result.more,
                    moreHot: !!result.moreHot,
                    hotComments: result.hotComments || [],
                    comments: result.comments || [],
                }
            }
            return null
        } catch (e) {
            console.error("[DiscoveryService] getPlaylistComments failed:", e)
            return null
        }
    }
}

export const discoveryService = DiscoveryService.getInstance()
