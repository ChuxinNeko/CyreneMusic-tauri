import { urlService } from "./urlService"

export interface SongWikiSummary {
    blocks?: Array<{
        code: string
        creatives?: Array<{
            creativeType: string
            uiElement?: {
                textLinks?: Array<{ text: string }>
                mainTitle?: { title: string }
            }
            resources?: Array<{
                uiElement?: {
                    mainTitle?: { title: string }
                }
            }>
        }>
    }>
}

class NeteaseSongWikiService {
    /**
     * 获取歌曲百科摘要 (Wiki Summary)
     * 包含：曲风、语种、发行时间、简介等
     */
    public async fetchSongWiki(id: string | number): Promise<SongWikiSummary | null> {
        try {
            const resp = await fetch(`${urlService.baseUrl}/song/wiki/summary?id=${id}`)
            if (!resp.ok) return null
            const data = await resp.json()
            if (data.status !== 200) return null
            return data.data as SongWikiSummary
        } catch (error) {
            console.error('[SongWikiService] 获取百科失败:', error)
            return null
        }
    }

    /**
     * 获取歌曲音轨详细信息 (Music Detail)
     * 包含：BPM、能量值、情感倾向等
     */
    public async fetchSongMusicDetail(id: string | number): Promise<any | null> {
        try {
            const resp = await fetch(`${urlService.baseUrl}/song/music/detail/get?id=${id}`)
            if (!resp.ok) return null
            const data = await resp.json()
            if (data.status !== 200) return null
            return data.data
        } catch (error) {
            console.error('[SongWikiService] 获取歌曲元数据失败:', error)
            return null
        }
    }
}

export const neteaseSongWikiService = new NeteaseSongWikiService()
