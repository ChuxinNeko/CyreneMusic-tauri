import { Track } from '../models/track'
import { MusicSource } from './audioSourceService'
import { urlService } from './urlService'
import { useAuthStore } from '../store/useAuthStore'
import { apiFetch } from './apiClient'

class HeartModeService {
    private queue: Track[] = []
    private currentIndex = 0
    private isFetching = false
    private lastSeedId: string | number | null = null
    private lastPlaylistId: string | null = null
    private cachedFavoritesPlaylistId: string | null = null

    /**
     * 获取用户「我喜欢的音乐」歌单 ID（缓存）
     */
    private async getFavoritesPlaylistId(): Promise<string> {
        if (this.cachedFavoritesPlaylistId) return this.cachedFavoritesPlaylistId

        const token = useAuthStore.getState().token
        if (!token) throw new Error('请先登录后再使用心动模式')

        const response = await apiFetch(`${urlService.baseUrl}/netease/user/playlists?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('获取用户歌单失败')

        const result = await response.json()
        const playlists = result?.data?.playlists || []
        if (playlists.length === 0) throw new Error('未找到可用歌单，请先创建或收藏歌单')

        this.cachedFavoritesPlaylistId = String(playlists[0].id)
        return this.cachedFavoritesPlaylistId
    }

    /**
     * 调用后端心动模式接口，获取智能播放列表并填充内部队列
     */
    private async fetchIntelligenceList(songId: string | number, playlistId: string, startMusicId?: string | number): Promise<Track[]> {
        const token = useAuthStore.getState().token
        if (!token) {
            throw new Error('请先登录后再使用心动模式')
        }

        const params = new URLSearchParams({
            id: String(songId),
            pid: playlistId,
        })
        if (startMusicId !== undefined) {
            params.set('sid', String(startMusicId))
        }

        const response = await apiFetch(`${urlService.baseUrl}/playmode/intelligence/list?${params}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        })

        if (!response.ok) {
            const errText = await response.text().catch(() => '')
            throw new Error(`心动模式请求失败 (HTTP ${response.status}): ${errText.slice(0, 100)}`)
        }

        const result = await response.json()
        if (result.code !== 200 || !result.data) {
            throw new Error(result.message || '获取心动模式列表失败')
        }

        const items = Array.isArray(result.data) ? result.data : (result.data?.data || [])
        return this.convertItemsToTracks(items)
    }

    /**
     * 将心动模式 API 返回的歌曲数据转换为 Track 对象
     */
    private convertItemsToTracks(items: any[]): Track[] {
        const tracks: Track[] = []
        for (const item of items) {
            const song = item.songInfo || item.song || item
            if (!song || !song.id) continue

            const artistsData = song.ar || song.artists || []
            const artists = Array.isArray(artistsData)
                ? artistsData.map((a: any) => typeof a === 'string' ? a : a.name).join(' / ')
                : String(artistsData)

            const albumData = song.al || song.album || {}
            const album = typeof albumData === 'string' ? albumData : (albumData.name || '')
            const picUrl = song.picUrl || (typeof albumData === 'object' ? albumData.picUrl : '') || ''

            tracks.push({
                id: song.id,
                name: song.name,
                artists,
                album,
                picUrl: picUrl.replace('http://', 'https://'),
                source: MusicSource.Netease,
                duration: song.dt ? song.dt / 1000 : (song.duration || 0) / (song.duration > 1000 ? 1000 : 1),
            })
        }
        return tracks
    }

    /**
     * 开启心动模式：以当前歌曲为种子获取智能播放列表
     */
    public async start(songId: string | number, _playlistId?: string | null): Promise<void> {
        const pid = await this.getFavoritesPlaylistId()
        this.lastSeedId = songId
        this.lastPlaylistId = pid
        this.queue = []
        this.currentIndex = 0

        const tracks = await this.fetchIntelligenceList(songId, pid, songId)
        // 过滤掉种子歌曲本身（它正在播放）
        this.queue = tracks.filter(t => String(t.id) !== String(songId))
        console.log(`[HeartMode] 已开启心动模式，种子歌曲: ${songId}，获取到 ${this.queue.length} 首推荐`)
    }

    /**
     * 关闭心动模式，清空内部队列
     */
    public stop(): void {
        this.queue = []
        this.currentIndex = 0
        this.lastSeedId = null
        this.lastPlaylistId = null
        this.isFetching = false
    }

    /**
     * 获取下一首心动模式歌曲，队列耗尽时自动以最后一首歌为种子续拉
     */
    public async getNextTrack(): Promise<Track | null> {
        if (this.currentIndex < this.queue.length) {
            const track = this.queue[this.currentIndex]
            this.currentIndex++
            return track
        }

        // 队列耗尽，尝试以最后一首播放的歌为种子续拉
        if (!this.lastSeedId || this.isFetching) {
            return null
        }

        this.isFetching = true
        try {
            const refillPid = this.lastPlaylistId || await this.getFavoritesPlaylistId()
            const newTracks = await this.fetchIntelligenceList(
                this.lastSeedId,
                refillPid,
                this.lastSeedId,
            )
            // 过滤掉刚刚播放过的种子歌曲
            this.queue = newTracks.filter(t => String(t.id) !== String(this.lastSeedId))
            this.currentIndex = 0

            if (this.queue.length > 0) {
                const track = this.queue[this.currentIndex]
                this.currentIndex++
                return track
            }
            return null
        } catch (e) {
            console.error('[HeartMode] 续拉失败:', e)
            return null
        } finally {
            this.isFetching = false
        }
    }

    /**
     * 更新种子歌曲（每次播放新歌时调用，用于续拉时作为上下文）
     */
    public updateSeed(songId: string | number): void {
        this.lastSeedId = songId
    }

    /**
     * 是否正在拉取中
     */
    public get isLoading(): boolean {
        return this.isFetching
    }
}

export const heartModeService = new HeartModeService()