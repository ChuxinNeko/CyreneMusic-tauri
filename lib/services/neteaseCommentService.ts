import { urlService } from "./urlService"

/** 评论中的楼中楼回复条目 */
export interface BeReplied {
    beRepliedCommentId: number
    content: string
    status?: number
    user?: {
        userId?: number
        nickname?: string
        avatarUrl?: string
        vipType?: number
    }
}

/** 单条评论 */
export interface CommentItem {
    commentId: number
    content: string
    richContent?: string
    time: number
    timeStr?: string
    likedCount: number
    liked?: boolean
    status?: number
    parentCommentId?: number
    ipLocation?: { location?: string }
    user?: {
        userId?: number
        nickname?: string
        avatarUrl?: string
        vipType?: number
        avatarDetail?: { url?: string } | null
        vipRights?: any
    }
    beReplied?: BeReplied[]
}

/** 歌曲评论响应 */
export interface SongComments {
    total: number
    more: boolean
    moreHot: boolean
    hotComments: CommentItem[]
    comments: CommentItem[]
}

class NeteaseCommentService {
    /**
     * 获取歌曲评论 (热门评论 + 最新评论)
     * @param id 歌曲 ID
     * @param limit 取出评论数量，默认 20
     * @param offset 偏移数量，用于分页
     * @param before 分页参数，取上一页最后一项的 time 获取下一页(超过 5000 条评论时使用)
     */
    public async fetchSongComments(
        id: string | number,
        limit: number = 20,
        offset: number = 0,
        before: number = 0,
    ): Promise<SongComments | null> {
        try {
            const params = new URLSearchParams({
                id: String(id),
                limit: String(limit),
                offset: String(offset),
                before: String(before),
            })
            const resp = await fetch(`${urlService.baseUrl}/comment/music?${params.toString()}`)
            if (!resp.ok) return null
            const data = await resp.json()
            if (data.status !== 200) return null
            return {
                total: data.total ?? 0,
                more: !!data.more,
                moreHot: !!data.moreHot,
                hotComments: data.hotComments || [],
                comments: data.comments || [],
            } as SongComments
        } catch (error) {
            console.error('[CommentService] 获取歌曲评论失败:', error)
            return null
        }
    }
}

export const neteaseCommentService = new NeteaseCommentService()
