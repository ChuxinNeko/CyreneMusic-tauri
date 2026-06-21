"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2, ThumbsUp, MessageCircle, Flame, Clock, ArrowDownWideNarrow } from "lucide-react"
import { discoveryService } from "@/lib/services/discoveryService"
import { AsyncImage } from "@/components/common/AsyncImage"

interface CommentUser {
    userId: string | number
    nickname: string
    avatarUrl: string
}

interface CommentItem {
    commentId: string | number
    user: CommentUser
    content: string
    time: number
    likedCount: number
    liked: boolean
    replyCount?: number
}

interface PlaylistCommentsProps {
    playlistId: string | number
}

type SortType = 0 | 1

const SORT_OPTIONS: { value: SortType; label: string; icon: typeof Clock }[] = [
    { value: 0, label: "按时间", icon: Clock },
    { value: 1, label: "按热度", icon: ArrowDownWideNarrow },
]

function formatCount(count: number): string {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    return String(count)
}

function formatTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 30) return `${days} 天前`

    const date = new Date(timestamp)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const currentYear = new Date().getFullYear()
    return y === currentYear ? `${m}-${d}` : `${y}-${m}-${d}`
}

/** 骨架屏：单条评论占位 */
function CommentSkeleton() {
    return (
        <div className="flex gap-3 p-3 rounded-xl">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
            </div>
        </div>
    )
}

/** 骨架屏：加载态列表 */
function CommentSkeletonGroup() {
    return (
        <div className="space-y-1 px-1">
            {Array.from({ length: 6 }).map((_, i) => (
                <CommentSkeleton key={i} />
            ))}
        </div>
    )
}

function CommentCard({ comment, isHot }: { comment: CommentItem; isHot?: boolean }) {
    const hasLikes = comment.likedCount > 0

    return (
        <div className="flex gap-3 p-3 rounded-xl transition-colors hover:bg-accent/30 group">
            <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-muted ring-2 ring-transparent group-hover:ring-primary/10 transition-all">
                <AsyncImage
                    src={comment.user.avatarUrl}
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="flex-1 min-w-0">
                {/* 顶行：昵称 + 时间 */}
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground/80 truncate group-hover:text-foreground transition-colors">
                        {comment.user.nickname}
                    </span>
                    <span className="text-[11px] text-muted-foreground/40 flex-shrink-0">
                        {formatTime(comment.time)}
                    </span>
                </div>
                {/* 正文 + 点赞：正文占满左侧，点赞贴右下角 */}
                <div className="flex items-end justify-between gap-3 mt-1.5">
                    <p className="text-[13px] text-foreground/85 leading-[1.6] whitespace-pre-wrap break-words min-w-0">
                        {comment.content}
                    </p>
                    {(hasLikes || isHot) && (
                        <button className="flex items-center gap-1 flex-shrink-0 self-end pb-0.5 transition-colors group/like">
                            <ThumbsUp className={`h-3.5 w-3.5 transition-colors ${
                                hasLikes
                                    ? "text-primary/60 group-hover/like:text-primary"
                                    : "text-muted-foreground/30 group-hover/like:text-muted-foreground/60"
                            }`} />
                            {hasLikes && (
                                <span className="text-[11px] font-medium text-primary/50 group-hover/like:text-primary/80 transition-colors">
                                    {formatCount(comment.likedCount)}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

/** 排序方式选择器 */
function SortSelector({ value, onChange }: { value: SortType; onChange: (v: SortType) => void }) {
    return (
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/40">
            {SORT_OPTIONS.map(opt => {
                const Icon = opt.icon
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            active
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground/60 hover:text-muted-foreground/90"
                        }`}
                    >
                        <Icon className="h-3 w-3" />
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

export function PlaylistComments({ playlistId }: PlaylistCommentsProps) {
    const [hotComments, setHotComments] = useState<CommentItem[]>([])
    const [comments, setComments] = useState<CommentItem[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [offset, setOffset] = useState(0)
    const [sortType, setSortType] = useState<SortType>(0)
    const pageSize = 20
    const observerRef = useRef<HTMLDivElement | null>(null)

    const fetchComments = useCallback(async (currentOffset: number, append: boolean = false) => {
        if (append) {
            setLoadingMore(true)
        } else {
            setLoading(true)
        }

        try {
            const data = await discoveryService.getPlaylistComments(
                playlistId,
                pageSize,
                currentOffset,
                0,
                sortType,
            )
            if (data) {
                if (!append) {
                    setHotComments(data.hotComments || [])
                }
                setComments(prev => append ? [...prev, ...(data.comments || [])] : (data.comments || []))
                setTotal(data.total)
                setHasMore(data.more)
                setOffset(currentOffset + pageSize)
            }
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [playlistId, sortType])

    // 切换排序时重置并重新拉取
    const handleSortChange = useCallback((newSort: SortType) => {
        if (newSort === sortType) return
        setSortType(newSort)
        setComments([])
        setHotComments([])
        setOffset(0)
        setHasMore(true)
    }, [sortType])

    // playlistId 或 sortType 变化时拉取
    useEffect(() => {
        setComments([])
        setHotComments([])
        setOffset(0)
        setHasMore(true)
        fetchComments(0)
    }, [playlistId, sortType]) // eslint-disable-line react-hooks/exhaustive-deps

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (!observerRef.current || !hasMore || loading || loadingMore) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    fetchComments(offset, true)
                }
            },
            { threshold: 0.1 },
        )
        observer.observe(observerRef.current)
        return () => observer.disconnect()
    }, [hasMore, loading, loadingMore, offset, fetchComments])

    if (loading) {
        return (
            <div className="w-full py-4 space-y-4">
                {/* 排序栏骨架 */}
                <div className="flex items-center justify-between px-1">
                    <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-7 w-28 rounded-lg bg-muted animate-pulse" />
                </div>
                {/* 热门评论骨架 */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                        <div className="h-3.5 w-6 rounded bg-muted/50 animate-pulse" />
                    </div>
                    <CommentSkeletonGroup />
                </div>
                {/* 最新评论骨架 */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                        <div className="h-3.5 w-8 rounded bg-muted/50 animate-pulse" />
                    </div>
                    <CommentSkeletonGroup />
                </div>
            </div>
        )
    }

    if (total === 0 && hotComments.length === 0 && comments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/40">
                <MessageCircle className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">暂无评论</p>
                <p className="text-xs text-muted-foreground/30">快来抢沙发吧</p>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* 顶部：评论总数 + 排序选择 */}
            <div className="flex items-center justify-between px-1 mb-3">
                <span className="text-sm font-bold text-foreground/70">
                    评论 <span className="text-xs font-medium text-muted-foreground/40">{formatCount(total)}</span>
                </span>
                <SortSelector value={sortType} onChange={handleSortChange} />
            </div>

            {/* 热门评论 */}
            {hotComments.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary/90">
                            <Flame className="h-3.5 w-3.5" />
                            <span>热门评论</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground/40 font-medium">{hotComments.length}</span>
                    </div>
                    <div className="rounded-xl bg-accent/20 p-1">
                        {hotComments.map(c => (
                            <CommentCard key={c.commentId} comment={c} isHot />
                        ))}
                    </div>
                </div>
            )}

            {/* 最新评论 */}
            {comments.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                            {sortType === 1 ? "最热评论" : "最新评论"}
                        </span>
                        <span className="text-[11px] text-muted-foreground/40 font-medium">{formatCount(total)}</span>
                    </div>
                    <div>
                        {comments.map(c => (
                            <CommentCard key={c.commentId} comment={c} />
                        ))}
                    </div>
                </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={observerRef} className="py-6 flex flex-col items-center justify-center gap-2">
                {loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground/50">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">加载更多评论...</span>
                    </div>
                )}
                {!hasMore && comments.length > 0 && (
                    <span className="text-xs text-muted-foreground/30 font-medium">— 到底啦 —</span>
                )}
            </div>
        </div>
    )
}