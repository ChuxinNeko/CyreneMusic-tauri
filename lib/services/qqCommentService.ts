import { urlService } from "./urlService"
import { CommentItem, SongComments } from "./neteaseCommentService"

/**
 * QQ 音乐评论服务。
 *
 * 后端 `/qq/comment/music` 已将 QQ 原始评论归一化为与网易云相同的结构，
 * 因此这里直接复用 neteaseCommentService 导出的 CommentItem / SongComments 类型，
 * 前端评论组件可对两种音源共用同一套渲染逻辑。
 */
class QQCommentService {
    /**
     * 获取 QQ 音乐评论（按页码分页）。
     * @param id        资源 ID（QQ 轨道的 songmid，后端会自动解析为数字 songid）
     * @param pagesize  每页评论数，默认 20
     * @param pagenum   页码，从 0 开始
     */
    public async fetchSongComments(
        id: string | number,
        pagesize: number = 20,
        pagenum: number = 0,
    ): Promise<SongComments | null> {
        try {
            const params = new URLSearchParams({
                id: String(id),
                pagesize: String(pagesize),
                pagenum: String(pagenum),
            })
            const resp = await fetch(`${urlService.baseUrl}/qq/comment/music?${params.toString()}`)
            if (!resp.ok) return null
            const data = await resp.json()
            if (data.status !== 200) return null
            return {
                total: data.total ?? 0,
                more: !!data.more,
                moreHot: !!data.moreHot,
                hotComments: (data.hotComments || []) as CommentItem[],
                comments: (data.comments || []) as CommentItem[],
            } as SongComments
        } catch (error) {
            console.error('[QQCommentService] 获取歌曲评论失败:', error)
            return null
        }
    }
}

export const qqCommentService = new QQCommentService()
