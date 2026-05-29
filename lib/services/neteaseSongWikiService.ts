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
    // 进程内语言缓存：避免同一首歌反复请求百科
    // 已查询但无语言的曲目缓存为空字符串，避免每次切歌都重新请求
    private languageCache = new Map<string, string>()
    // 进行中的请求缓存：避免短时间内同曲目并发触发多次请求
    private inflightLanguage = new Map<string, Promise<string>>()

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

    /**
     * 仅获取歌曲语种（轻量、带缓存），用于听歌语言统计
     * 命中缓存（含空字符串）则直接返回，未命中时复用 fetchSongWiki 并解析 creativeType==='language'
     */
    public async fetchSongLanguage(id: string | number): Promise<string> {
        const key = String(id)

        if (this.languageCache.has(key)) {
            return this.languageCache.get(key) || ''
        }
        const inflight = this.inflightLanguage.get(key)
        if (inflight) return inflight

        const task = (async () => {
            const data = await this.fetchSongWiki(id)
            const language = this.extractLanguage(data)
            this.languageCache.set(key, language)
            return language
        })()
            .catch((err) => {
                console.error('[SongWikiService] 获取歌曲语言失败:', err)
                return ''
            })
            .finally(() => {
                this.inflightLanguage.delete(key)
            })

        this.inflightLanguage.set(key, task)
        return task
    }

    private extractLanguage(data: SongWikiSummary | null): string {
        if (!data) return ''
        const basicBlock = data.blocks?.find(b => b.code === 'SONG_PLAY_ABOUT_SONG_BASIC')
        const creatives = basicBlock?.creatives || []
        for (const creative of creatives) {
            if (creative.creativeType === 'language') {
                const textLinks = creative.uiElement?.textLinks || []
                if (textLinks.length > 0 && textLinks[0].text) {
                    return textLinks[0].text
                }
            }
        }
        return ''
    }
}

export const neteaseSongWikiService = new NeteaseSongWikiService()
