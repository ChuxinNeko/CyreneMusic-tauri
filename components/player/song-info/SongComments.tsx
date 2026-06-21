"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { Track } from "@/lib/models/track"
import {
    neteaseCommentService,
    CommentItem,
    SongComments,
} from "@/lib/services/neteaseCommentService"
import { qqCommentService } from "@/lib/services/qqCommentService"
import { Heart, Loader2, ChevronRight, Clock, ArrowDownWideNarrow } from "lucide-react"

interface SongCommentsProps {
    track: Track | null
}

type SortType = 0 | 1

const SORT_OPTIONS: { value: SortType; label: string; icon: typeof Clock }[] = [
    { value: 0, label: "按时间", icon: Clock },
    { value: 1, label: "按热度", icon: ArrowDownWideNarrow },
]

/** 支持展示评论的音源 */
const SUPPORTED_SOURCES = ["netease", "qq"] as const
const isCommentSupported = (track: Track | null): boolean =>
    !!track && (SUPPORTED_SOURCES as readonly string[]).includes(track.source)

/** 单页评论数量 */
const PAGE_SIZE = 20
/** 首屏展示的热门评论数量上限（热门评论仅在首页返回） */
const HOT_PREVIEW_LIMIT = 3

/** 统一头像 URL：强制 https */
const toAvatarUrl = (url?: string): string => {
    if (!url) return ""
    return url.replace("http://", "https://")
}

/** 点赞数格式化：>=1万显示万 */
const formatCount = (count: number): string => {
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    return String(count)
}

/** 排序方式选择器（深色主题，白/透明风格） */
function SortSelector({ value, onChange }: { value: SortType; onChange: (v: SortType) => void }) {
    return (
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.06]">
            {SORT_OPTIONS.map(opt => {
                const Icon = opt.icon
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                            active
                                ? "bg-white/[0.12] text-white shadow-sm"
                                : "text-white/40 hover:text-white/60"
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

export function SongComments({ track }: SongCommentsProps) {
    // 首页数据：热门评论 + 最新评论首页
    const [firstPage, setFirstPage] = useState<SongComments | null>(null)
    // 最新评论分页（不含首页，从第 2 页开始）
    const [latestPage, setLatestPage] = useState<CommentItem[]>([])
    const [offset, setOffset] = useState(0)
    // before 分页游标（用于超过 5000 条评论后的翻页，仅网易云）
    const beforeRef = useRef<number>(0)
    // 页码游标（QQ 按页码分页，记录下一页页码）
    const pageRef = useRef<number>(0)

    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [sortType, setSortType] = useState<SortType>(0)
    // 用于强制重新触发 effect
    const reqIdRef = useRef(0)

    /** 按音源拉取指定页评论 */
    const fetchBySource = useCallback(
        (track: Track, isFirst: boolean): Promise<SongComments | null> => {
            if (track.source === "qq") {
                const page = isFirst ? 0 : pageRef.current
                return qqCommentService.fetchSongComments(track.id, PAGE_SIZE, page, sortType)
            }
            // 默认走网易云
            return neteaseCommentService.fetchSongComments(
                track.id,
                PAGE_SIZE,
                isFirst ? 0 : offset,
                isFirst ? 0 : beforeRef.current,
                sortType,
            )
        },
        [offset, sortType],
    )

    /** 加载第一页（热门评论 + 最新评论首页） */
    useEffect(() => {
        const reqId = ++reqIdRef.current
        const fetchFirst = async () => {
            // 仅支持的音源（网易云 / QQ）
            if (!isCommentSupported(track)) {
                setFirstPage(null)
                setLatestPage([])
                return
            }

            setIsLoading(true)
            setError(null)
            try {
                const data = await fetchBySource(track!, true)
                if (reqId !== reqIdRef.current) return // 已被新请求取代
                if (data) {
                    setFirstPage(data)
                    setLatestPage([])
                    setOffset(PAGE_SIZE)
                    pageRef.current = 1
                    beforeRef.current =
                        data.comments.length > 0
                            ? data.comments[data.comments.length - 1].time
                            : 0
                } else {
                    setFirstPage(null)
                }
            } catch (err) {
                console.error("Failed to fetch comments", err)
                setError("评论加载失败")
                setFirstPage(null)
            } finally {
                if (reqId === reqIdRef.current) setIsLoading(false)
            }
        }
        fetchFirst()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [track, sortType])

    /** 加载更多最新评论 */
    const loadMore = useCallback(async () => {
        if (!track || isLoadingMore || !firstPage?.more) return
        setIsLoadingMore(true)
        try {
            const data = await fetchBySource(track, false)
            if (data) {
                setLatestPage((prev) => [...prev, ...data.comments])
                setOffset((prev) => prev + PAGE_SIZE)
                pageRef.current += 1
                if (data.comments.length > 0) {
                    beforeRef.current = data.comments[data.comments.length - 1].time
                }
                setFirstPage((prev) => (prev ? { ...prev, more: data.more } : prev))
            }
        } catch (err) {
            console.error("Failed to load more comments", err)
        } finally {
            setIsLoadingMore(false)
        }
    }, [track, isLoadingMore, firstPage, fetchBySource])

    /** 切换排序 */
    const handleSortChange = useCallback((newSort: SortType) => {
        if (newSort === sortType) return
        setSortType(newSort)
        setExpanded(false)
        setLatestPage([])
        setOffset(0)
        pageRef.current = 0
        beforeRef.current = 0
        // useEffect 会因 sortType 变化自动重新拉取
    }, [sortType])

    // 加载中
    if (isLoading) {
        return (
            <div className="w-full max-w-xl mx-auto p-4 flex justify-center mb-8">
                <Loader2 size={20} className="animate-spin text-white/50" />
            </div>
        )
    }

    // 非支持音源 / 无评论
    if (!isCommentSupported(track)) return null
    if (error) {
        return (
            <div className="w-full max-w-xl mx-auto mb-8 px-2">
                <p className="text-[13px] text-white/40">{error}</p>
            </div>
        )
    }
    if (!firstPage) return null
    if (
        firstPage.hotComments.length === 0 &&
        firstPage.comments.length === 0
    ) {
        return null
    }

    // 热门评论：收起时仅展示前 N 条，展开时全部
    const hotToShow = expanded
        ? firstPage.hotComments
        : firstPage.hotComments.slice(0, HOT_PREVIEW_LIMIT)

    // 最新评论：收起时仅展示首页前 N 条，展开时展示首页全部 + 后续分页
    const latestToShow = expanded
        ? [...firstPage.comments, ...latestPage]
        : firstPage.comments.slice(0, HOT_PREVIEW_LIMIT)

    const hasHot = firstPage.hotComments.length > 0
    const hasLatest = firstPage.comments.length > 0

    // 是否需要展示「展开」按钮
    const canExpand =
        !expanded &&
        (firstPage.hotComments.length > HOT_PREVIEW_LIMIT ||
            firstPage.comments.length > HOT_PREVIEW_LIMIT)

    return (
        <div className="w-full max-w-xl mx-auto mb-8">
            {/* 标题行：评论标题 + 排序选择器 */}
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <h4 className="text-[16px] font-semibold text-white">评论</h4>
                    <span className="text-[12px] text-white/40">
                        {formatCount(firstPage.total)}
                    </span>
                </div>
                <SortSelector value={sortType} onChange={handleSortChange} />
            </div>

            {/* 热门评论 */}
            {hasHot && (
                <div className="mb-4">
                    <p className="text-[12px] font-medium text-white/50 mb-2 px-2">
                        精彩评论
                    </p>
                    <div className="space-y-3">
                        {hotToShow.map((c) => (
                            <CommentRow key={`hot-${c.commentId}`} comment={c} />
                        ))}
                    </div>
                </div>
            )}

            {/* 最新评论 */}
            {hasLatest && (
                <div>
                    {(hasHot || expanded) && (
                        <p className="text-[12px] font-medium text-white/50 mb-2 px-2">
                            {sortType === 1 ? "最热评论" : "最新评论"}
                        </p>
                    )}
                    <div className="space-y-3">
                        {latestToShow.map((c) => (
                            <CommentRow key={`latest-${c.commentId}`} comment={c} />
                        ))}
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-4 mt-4">
                {canExpand && (
                    <button
                        onClick={() => setExpanded(true)}
                        className="flex items-center gap-1 text-[13px] text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10"
                    >
                        展开更多
                        <ChevronRight size={14} />
                    </button>
                )}
                {expanded && firstPage.more && (
                    <button
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="flex items-center gap-1 text-[13px] text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50"
                    >
                        {isLoadingMore ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <ChevronRight size={14} />
                        )}
                        加载更多
                    </button>
                )}
                {expanded && (
                    <button
                        onClick={() => setExpanded(false)}
                        className="text-[13px] text-white/50 hover:text-white/80 transition-colors px-3 py-1.5"
                    >
                        收起
                    </button>
                )}
            </div>
        </div>
    )
}

/** 单条评论渲染 */
function CommentRow({ comment }: { comment: CommentItem }) {
    const avatar = toAvatarUrl(comment.user?.avatarUrl)
    const nickname = comment.user?.nickname || "未知用户"
    const ipLocation = comment.ipLocation?.location
    const vipType = comment.user?.vipType || 0
    const isVip = vipType > 0

    return (
        <div className="flex gap-3 p-2 rounded-[8px] hover:bg-white/[0.03] transition-colors">
            {/* 头像 */}
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/5">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={nickname}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/20 text-[10px]">
                            {nickname.slice(0, 1)}
                        </span>
                    </div>
                )}
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[12px] font-medium text-white/70 hover:text-white transition-colors cursor-pointer">
                        {nickname}
                    </span>
                    {isVip && (
                        <span className="px-1 py-px text-[9px] font-bold rounded bg-gradient-to-r from-amber-400 to-orange-500 text-black leading-none">
                            VIP
                        </span>
                    )}
                </div>

                {/* 正文 */}
                {comment.content && (
                    <p className="text-[13px] text-white/90 leading-[1.5] break-words whitespace-pre-wrap">
                        {comment.content}
                    </p>
                )}

                {/* 楼中楼回复 */}
                {comment.beReplied && comment.beReplied.length > 0 && (
                    <div className="mt-1.5 space-y-1 bg-white/[0.04] rounded-[6px] p-2 border-l-2 border-white/10">
                        {comment.beReplied.map((r) => (
                            <p
                                key={r.beRepliedCommentId}
                                className="text-[12px] text-white/60 leading-[1.5] break-words"
                            >
                                <span className="text-white/80">
                                    @{r.user?.nickname || "未知用户"}:
                                </span>{" "}
                                {r.content}
                            </p>
                        ))}
                    </div>
                )}

                {/* 底部信息 */}
                <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-white/30">
                        {comment.timeStr || formatTime(comment.time)}
                    </span>
                    {ipLocation && (
                        <span className="text-[11px] text-white/30">
                            {ipLocation}
                        </span>
                    )}
                    <div className="flex items-center gap-1 ml-auto text-white/40">
                        <Heart
                            size={12}
                            className={comment.liked ? "fill-red-500 text-red-500" : ""}
                        />
                        {comment.likedCount > 0 && (
                            <span className="text-[11px]">
                                {formatCount(comment.likedCount)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/** 时间戳格式化为 yyyy-MM-dd */
function formatTime(ts: number): string {
    if (!ts) return ""
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}