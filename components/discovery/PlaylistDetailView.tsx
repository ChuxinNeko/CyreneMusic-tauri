"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { extractColorsFromImage } from "@/lib/utils/extractColors"
import { Play, ChevronLeft, Loader2, Trash2, Search, X, Music, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AsyncImage } from "@/components/common/AsyncImage"
import { discoveryService, PlaylistDetail } from "@/lib/services/discoveryService"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist, PlaylistTrack } from "@/lib/models/playlist"
import { playerService } from "@/lib/services/playerService"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Track } from "@/lib/models/track"
import { useLayoutStore, type ToplistSource } from "@/lib/store/useLayoutStore"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PlaylistComments } from "@/components/discovery/PlaylistComments"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"

interface PlaylistDetailViewProps {
    id: string | number
    onBack: () => void
    token?: string
    type?: 'discovery' | 'personal'
    onRemoveLocally?: (id: string | number) => void
    /** 榜单/歌单来源平台，决定走哪个后端端点（默认网易云） */
    toplistSource?: ToplistSource
    /** QQ 来源时区分：'toplist'=榜单详情（默认），'playlist'=歌单详情（如推荐歌单） */
    playlistType?: 'toplist' | 'playlist'
}

export function PlaylistDetailView({ id, onBack, token, type = 'discovery', onRemoveLocally, toplistSource = 'netease', playlistType = 'toplist' }: PlaylistDetailViewProps) {
    const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [searchKeyword, setSearchKeyword] = useState("")
    const [activeTab, setActiveTab] = useState<"songs" | "comments">("songs")
    const [coverColor, setCoverColor] = useState<{ r: number; g: number; b: number } | null>(null)
    const { currentTrack, isPlaying } = usePlayerStore()
    const { isImmersivePlaylistEnabled } = useLayoutStore()
    const immersiveBgRef = useRef<HTMLDivElement>(null)

    const showTabs = toplistSource === "netease" && type !== "personal"

    const onCoverLoad = (img: HTMLImageElement) => {
        try {
            const canvas = document.createElement("canvas")
            const size = 16
            canvas.width = size
            canvas.height = size
            const ctx = canvas.getContext("2d")
            if (!ctx) return
            ctx.drawImage(img, 0, 0, size, size)
            const data = ctx.getImageData(0, 0, size, size).data
            let r = 0, g = 0, b = 0
            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i + 1]; b += data[i + 2]
            }
            const count = data.length / 4
            setCoverColor({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) })
        } catch { /* tainted canvas — ignore */ }
    }

    const filteredTracks = useMemo(() => {
        if (!playlist) return []
        if (!searchKeyword.trim()) return playlist.tracks
        const kw = searchKeyword.trim().toLowerCase()
        return playlist.tracks.filter(t =>
            t.name.toLowerCase().includes(kw) ||
            (t.artists && t.artists.toLowerCase().includes(kw)) ||
            (t.album && t.album.toLowerCase().includes(kw))
        )
    }, [playlist, searchKeyword])

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true)
            if (type === 'personal') {
                const tracks = await playlistService.getPlaylistTracks(id)
                const allPlaylists = await playlistService.getPlaylists()
                const info = allPlaylists.find((p: Playlist) => String(p.id) === String(id))

                if (info) {
                    setPlaylist({
                        id: info.id,
                        name: info.name,
                        coverImgUrl: info.coverUrl || '',
                        description: '',
                        creator: '',
                        trackCount: info.trackCount,
                        playCount: 0,
                        tracks: tracks.map((t: any) => ({
                            id: t.trackId || t.track_id || t.id,
                            name: t.name || t.track_name,
                            artists: t.artists,
                            album: t.album,
                            picUrl: t.picUrl || t.pic_url,
                            source: t.source,
                            duration: 0
                        })),
                        createTime: 0,
                        updateTime: 0,
                        tags: []
                    })
                }
            } else {
                const data = await discoveryService.getPlaylistDetail(id, 200, token, toplistSource, playlistType)
                setPlaylist(data)
            }
            setLoading(false)
        }
        fetchDetail()
    }, [id, token, type, toplistSource, playlistType])

    useEffect(() => {
        const el = immersiveBgRef.current
        if (!el) return

        if (!isImmersivePlaylistEnabled || !playlist?.coverImgUrl) {
            el.style.opacity = '0'
            return
        }

        let isMounted = true
        let rafId: number

        // 确保初始状态为完全透明，且无 transition（防止纯色闪烁）
        el.style.opacity = '0'
        el.style.transition = ''

        // 与 WebGL 背景同款粒度：取一组代表色组成氛围光
        // - 主色（评分最高）= 顶部广域光
        // - 副色（按评分取 3~4 个）= 四角错落光斑
        // - 整体线性淡出
        extractColorsFromImage(playlist.coverImgUrl, 8)
            .then(colors => {
                if (!isMounted) return
                if (!colors || colors.length === 0) return

                // hsl(h, s%, l%)  ->  hsla(h, s%, l%, a)
                const withAlpha = (hsl: string, a: number) =>
                    hsl.replace(/^hsl\(/, 'hsla(').replace(/\)$/, `, ${a})`)

                const primary = colors[0]
                const accents = colors.slice(1, 5)
                const accentPositions = [
                    '18% 32%',  // 左上
                    '82% 28%',  // 右上
                    '28% 72%',  // 左下
                    '72% 75%',  // 右下
                ]

                const gradients: string[] = []

                // 顶部主氛围光
                gradients.push(
                    `radial-gradient(ellipse 140% 55% at 50% 0%, ${withAlpha(primary, 0.45)} 0%, ${withAlpha(primary, 0.18)} 50%, transparent 100%)`
                )

                // 副色光斑：四角错落
                accents.forEach((color, i) => {
                    const pos = accentPositions[i % accentPositions.length]
                    gradients.push(
                        `radial-gradient(ellipse 60% 45% at ${pos}, ${withAlpha(color, 0.30)} 0%, ${withAlpha(color, 0.10)} 50%, transparent 100%)`
                    )
                })

                // 整体向下淡出
                gradients.push(
                    `linear-gradient(180deg, ${withAlpha(primary, 0.15)} 0%, transparent 60%)`
                )

                el.style.background = gradients.join(', ')

                // 双 rAF：确保浏览器先完成 opacity:0 + 有背景 的绘制帧，
                // 再添加 transition 并触发 opacity 过渡，杜绝首帧纯色闪烁
                rafId = requestAnimationFrame(() => {
                    rafId = requestAnimationFrame(() => {
                        if (isMounted && el) {
                            el.style.transition = 'opacity 1s ease-out'
                            el.style.opacity = '1'
                        }
                    })
                })
            })
            .catch(e => {
                console.warn("[PlaylistDetailView] Failed to extract colors:", e)
            })

        return () => {
            isMounted = false
            cancelAnimationFrame(rafId)
        }
    }, [playlist?.coverImgUrl, isImmersivePlaylistEnabled])

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    if (!playlist) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">获取歌单详情失败</p>
                <Button onClick={onBack} variant="outline" className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> 返回首页
                </Button>
            </div>
        )
    }

    const handlePlayAll = () => {
        if (playlist.tracks.length > 0) {
            const fallbackSource = toplistSource === 'qq' ? 'qq' : 'netease'
            const tracks: Track[] = playlist.tracks.map(t => discoveryService.convertToTrack({
                ...t,
                source: (t as any).source || fallbackSource
            }))
            usePlayerStore.getState().setSourcePlaylistId(fallbackSource === 'netease' ? String(playlist.id) : null)
            playerService.playWithQueue(tracks[0], tracks)
        }
    }

    const handlePlayTrack = (track: any) => {
        const fallbackSource = toplistSource === 'qq' ? 'qq' : 'netease'
        const tracks: Track[] = playlist.tracks.map(t => discoveryService.convertToTrack({
            ...t,
            source: (t as any).source || fallbackSource
        }))
        const trackObj = discoveryService.convertToTrack({
            ...track,
            source: track.source || fallbackSource
        })
        usePlayerStore.getState().setSourcePlaylistId(fallbackSource === 'netease' ? String(playlist.id) : null)
        playerService.playWithQueue(trackObj, tracks)
    }

    const formatDuration = (ms: number) => {
        const s = Math.floor(ms / 1000)
        const m = Math.floor(s / 60)
        const remS = s % 60
        return `${m}:${remS.toString().padStart(2, '0')}`
    }

    const formatPlayCount = (count: number) => {
        if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`
        if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
        return count.toString()
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const success = await playlistService.deletePlaylist(id)
            if (success) {
                toast.success("歌单已成功删除")
                onRemoveLocally?.(id)
                onBack()
            } else {
                toast.error("删除歌单失败")
            }
        } catch (error) {
            toast.error("删除过程中发生错误")
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    return (
        <>
            {/* 沉浸模式全屏背景 —— 始终挂在根容器外侧，避免被根容器 animate-in 的 opacity<1 阶段变成 fixed 的 containing block 而被裁剪到容器内 */}
            <div
                ref={immersiveBgRef}
                aria-hidden="true"
                className="fixed inset-0 pointer-events-none -z-20"
                style={{
                    opacity: 0,
                    willChange: 'opacity',
                }}
            />
            <div className="space-y-4 animate-in fade-in duration-500 pb-20 max-w-6xl w-full mx-auto px-4 sm:px-0 relative pt-[env(safe-area-inset-top)] isolate overflow-x-hidden">
            {/* 移动端全宽顶部封面渐变背景 */}
            <div className="md:hidden absolute top-0 inset-x-0 aspect-square sm:max-h-[500px] -z-10 pointer-events-none overflow-hidden origin-top">
                <AsyncImage src={playlist.coverImgUrl} className="w-full h-full object-cover scale-105" lazy={false} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-background/60 to-background" />
            </div>

            {/* Action Bar / Back Button */}
            <div className="absolute top-[max(40px,calc(env(safe-area-inset-top)+32px))] left-4 md:static md:top-auto md:left-auto flex items-center md:pt-4 md:pb-6 md:translate-y-0 z-50">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-8 gap-1 transition-colors hover:bg-background/60 text-foreground rounded-full px-3 bg-background/40 backdrop-blur-md"
                >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">返回</span>
                </Button>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12 items-center md:items-start text-center md:text-left relative z-10">
                {/* 桌面端封面图区域 (移动端隐藏) */}
                <div className="hidden md:block relative md:w-44 lg:w-56 aspect-square md:rounded-2xl overflow-hidden md:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.2)] flex-shrink-0 bg-muted transition-all duration-300">
                    <AsyncImage src={playlist.coverImgUrl} className="w-full h-full object-cover scale-105" lazy={false} />
                </div>

                <div className="flex-1 min-w-0 space-y-4 md:space-y-3 pt-[70vw] sm:pt-[250px] md:pt-1 flex flex-col items-center md:items-start w-full px-4 md:px-0">
                    <div className="space-y-2 md:space-y-1 w-full">
                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest block text-center md:text-left hidden md:block">歌单</span>
                        <h1 className="text-2xl sm:text-3xl md:text-xl lg:text-2xl font-black tracking-tight leading-tight text-foreground break-words text-center md:text-left">
                            {playlist.name}
                        </h1>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-1.5 text-[13px] md:text-sm font-medium">
                        <span className="text-primary font-bold hover:underline cursor-pointer transition-colors">
                            {playlist.creator}
                        </span>
                        <span className="text-muted-foreground/60 hidden md:inline">创建</span>
                    </div>

                    {playlist.description && (
                        <div className="space-y-1 group/desc">
                            <div
                                className={`relative overflow-hidden transition-all duration-500 ease-in-out ${isDescriptionExpanded ? "max-h-[1000px] opacity-100" : "max-h-[3em] opacity-80"
                                    }`}
                            >
                                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-wrap font-medium text-center md:text-left">
                                    {playlist.description}
                                </p>
                            </div>
                            {playlist.description.length > 80 && (
                                <button
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                    className="text-xs font-bold text-primary hover:underline transition-all flex items-center gap-1"
                                >
                                    {isDescriptionExpanded ? "收起" : "更多"}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 md:gap-x-5 gap-y-2 text-xs md:text-xs font-bold text-muted-foreground/50 md:text-muted-foreground/70">
                        {playlist.tags && playlist.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="md:hidden">·</span>
                                <span className="text-muted-foreground/30 font-normal hidden md:inline">#</span>
                                <span>{playlist.tags.join(' / ')}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 md:gap-4">
                            <span className="flex items-center gap-1">
                                <span className="md:hidden">·</span>
                                <ListMusicInIcon className="h-3 w-3 md:h-3.5 md:w-3.5 hidden md:block" />
                                {playlist.trackCount} 首歌曲
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="md:hidden">·</span>
                                <PlayInIcon className="h-3 w-3 hidden md:block" />
                                {formatPlayCount(playlist.playCount)} 次播放
                            </span>
                        </div>
                    </div>

                    <div className="pt-2 md:pt-3 w-full flex items-center justify-center md:justify-start gap-3">
                        <Button
                            onClick={handlePlayAll}
                            className="h-12 md:h-11 flex-1 md:flex-none md:px-7 rounded-2xl md:rounded-full gap-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all font-bold shadow-lg shadow-foreground/10 text-[15px] md:text-sm"
                        >
                            <Play className="h-5 w-5 md:h-4 md:w-4 fill-current" />
                            播放全部
                        </Button>

                        {type === 'personal' && (
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="h-12 w-12 md:h-11 md:w-11 rounded-2xl md:rounded-full text-destructive bg-destructive/10 hover:bg-destructive/20 transition-all flex-shrink-0"
                                title="删除歌单"
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <Tabs value={showTabs ? activeTab : "songs"} onValueChange={(v) => setActiveTab(v as "songs" | "comments")} className="pt-2 md:pt-4">
                {showTabs && (
                    <TabsList className={`mb-3 ${isImmersivePlaylistEnabled ? 'bg-background/40 backdrop-blur-md border border-border/30' : ''}`}>
                        <TabsTrigger value="songs" className="gap-1.5">
                            <Music className="h-4 w-4" />
                            歌曲
                        </TabsTrigger>
                        <TabsTrigger value="comments" className="gap-1.5">
                            <MessageSquare className="h-4 w-4" />
                            评论
                        </TabsTrigger>
                    </TabsList>
                )}

                <TabsContent value="songs" className="outline-none">
                <div className="relative px-1 md:px-0 pb-2">
                    <Search className="absolute left-4 md:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        placeholder="搜索歌单内歌曲..."
                        className={`w-full h-10 pl-10 pr-9 md:pl-9 md:pr-9 rounded-xl border text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all ${isImmersivePlaylistEnabled ? 'bg-background/40 backdrop-blur-md border-border/30' : 'bg-accent/40 border-border/40'}`}
                    />
                    {searchKeyword && (
                        <button
                            onClick={() => setSearchKeyword("")}
                            className="absolute right-4 md:right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted-foreground/10 text-muted-foreground/60 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* 桌面端表头，移动端隐藏 */}
                <div className="hidden md:flex items-center px-4 py-3 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-t border-b border-border/40 mb-2">
                    <span className="w-12 text-center">#</span>
                    <span className="flex-[2.5] px-4">标题</span>
                    <span className="flex-[1.5] px-4 hidden lg:block">专辑</span>
                    <span className="flex-1 px-4 hidden md:block">歌手</span>
                </div>

                {filteredTracks.length === 0 && searchKeyword.trim() && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                        <Search className="h-8 w-8 mb-3 opacity-40" />
                        <p className="text-sm font-medium">未找到匹配的歌曲</p>
                    </div>
                )}

                <div className="space-y-[1px]">
                    {filteredTracks.map((track, index) => {
                        const trackSource = (track as any).source || (toplistSource === 'qq' ? 'qq' : 'netease')
                        const isCurrent = currentTrack?.id === track.id && currentTrack?.source === trackSource
                        return (
                            <div
                                key={track.id}
                                onClick={() => handlePlayTrack(track)}
                                className={`flex items-center px-2 py-3 md:px-4 md:py-3 rounded-xl transition-all duration-200 group cursor-pointer border border-transparent ${isCurrent ? 'bg-primary/5 md:bg-primary/5 border-primary/10' : 'hover:bg-accent/40 active:bg-accent/60 md:active:bg-transparent'
                                    }`}
                            >
                                {/* 移动端隐藏序号 */}
                                <div className="w-10 md:w-12 hidden md:flex items-center justify-center">
                                    {isCurrent && isPlaying ? (
                                        <div className="flex items-end gap-[2px] h-3.5 mb-0.5">
                                            <div className="w-[3px] bg-primary animate-[music-bar-1_0.8s_ease-in-out_infinite]" />
                                            <div className="w-[3px] bg-primary animate-[music-bar-2_0.8s_ease-in-out_infinite]" />
                                            <div className="w-[3px] bg-primary animate-[music-bar-3_0.8s_ease-in-out_infinite]" />
                                        </div>
                                    ) : (
                                        <span className={`text-[13px] font-bold tracking-tighter ${isCurrent ? 'text-primary' : 'text-muted-foreground/30'} group-hover:hidden transition-colors`}>
                                            {index + 1}
                                        </span>
                                    )}
                                    <span className="hidden group-hover:flex items-center justify-center text-foreground/80">
                                        <Play className={`h-4 w-4 ${isCurrent ? 'text-primary' : ''} fill-current`} />
                                    </span>
                                </div>

                                {/* 列表项主体信息 */}
                                <div className="flex-[4] md:flex-[2.5] px-2 md:px-4 min-w-0 flex items-center gap-3 md:gap-4 pl-2 md:pl-0">
                                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-md md:rounded-lg overflow-hidden flex-shrink-0 shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md bg-muted">
                                        <AsyncImage src={track.picUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2 md:pr-0 text-left">
                                        <h4 className={`font-bold text-[14px] md:text-[15px] truncate transition-colors leading-snug ${isCurrent ? 'text-primary' : 'text-foreground group-hover:text-primary'
                                            }`}>
                                            {track.name}
                                        </h4>
                                        <div className="text-[12px] md:text-[12px] text-muted-foreground/80 truncate md:hidden mt-0.5 block">
                                            {track.artists}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-[1.5] px-4 hidden lg:block text-sm text-muted-foreground/60 truncate font-medium">
                                    {track.album}
                                </div>

                                <div className="flex-1 px-4 hidden md:block text-sm text-muted-foreground/80 truncate font-bold">
                                    {track.artists}
                                </div>

                            </div>
                        )
                    })}
                </div>
                    </TabsContent>

                    {showTabs && (
                        <TabsContent value="comments" className="outline-none">
                            <PlaylistComments playlistId={playlist.id} />
                        </TabsContent>
                    )}
                </Tabs>

            <style jsx global>{`
                @keyframes music-bar-1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
                @keyframes music-bar-2 { 0%, 100% { height: 14px; } 50% { height: 6px; } }
                @keyframes music-bar-3 { 0%, 100% { height: 8px; } 50% { height: 16px; } }
            `}</style>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>删除歌单</DialogTitle>
                        <DialogDescription>
                            确定要删除歌单「{playlist.name}」吗？此操作无法撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                            取消
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            确认删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </div>
        </>
    )
}

export function DailySongsDetailView({ songs, onBack }: { songs: any[], onBack: () => void }) {
    const { currentTrack, isPlaying } = usePlayerStore()
    const [searchKeyword, setSearchKeyword] = useState("")

    const filteredSongs = useMemo(() => {
        if (!searchKeyword.trim()) return songs
        const kw = searchKeyword.trim().toLowerCase()
        return songs.filter(s => {
            const t = discoveryService.convertToTrack(s)
            return t.name.toLowerCase().includes(kw) ||
                (t.artists && t.artists.toLowerCase().includes(kw)) ||
                (t.album && t.album.toLowerCase().includes(kw))
        })
    }, [songs, searchKeyword])

    const handlePlayAll = () => {
        if (songs.length > 0) {
            const tracks = songs.map(s => discoveryService.convertToTrack(s))
            playerService.playWithQueue(tracks[0], tracks)
        }
    }

    const handlePlayTrack = (song: any) => {
        const tracks = songs.map(s => discoveryService.convertToTrack(s))
        const track = discoveryService.convertToTrack(song)
        playerService.playWithQueue(track, tracks)
    }

    const formatDuration = (s: number) => {
        const m = Math.floor(s / 60)
        const remS = Math.floor(s % 60)
        return `${m}:${remS.toString().padStart(2, '0')}`
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20 max-w-6xl w-full mx-auto px-4 sm:px-0 relative pt-[env(safe-area-inset-top)] isolate overflow-x-hidden">
            {/* 移动端全宽顶部推荐封面渐变背景 */}
            <div className="md:hidden absolute top-0 inset-x-0 aspect-square sm:max-h-[500px] -z-10 pointer-events-none flex flex-col items-center justify-center bg-primary/10 overflow-hidden">
                <div className="text-center space-y-4 -mt-10">
                    <div className="text-[120px] leading-none font-black text-primary/80">{new Date().getDate()}</div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
            </div>

            {/* Action Bar / Back Button */}
            <div className="absolute top-[max(40px,calc(env(safe-area-inset-top)+32px))] left-4 md:static md:top-auto md:left-auto flex items-center md:pt-4 md:pb-6 md:translate-y-0 z-50">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-8 gap-1 transition-colors hover:bg-background/60 text-foreground rounded-full px-3 bg-background/40 backdrop-blur-md"
                >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">返回</span>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12 items-center md:items-start text-center md:text-left relative z-10">
                {/* 桌面端封面图区域 (移动端隐藏) */}
                <div className="hidden md:flex relative md:w-44 lg:w-56 aspect-square md:rounded-2xl overflow-hidden md:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.2)] flex-shrink-0 bg-primary/10 items-center justify-center transition-all duration-300">
                    <div className="text-center space-y-2">
                        <div className="text-6xl font-black text-primary">{new Date().getDate()}</div>
                        <div className="text-sm font-bold text-primary/60">每日歌曲推荐</div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-4 md:space-y-3 pt-[70vw] sm:pt-[250px] md:pt-1 flex flex-col items-center md:items-start w-full px-4 md:px-0">
                    <div className="space-y-2 md:space-y-1 w-full">
                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest text-center md:text-left hidden md:block">推荐内容</span>
                        <h1 className="text-2xl sm:text-3xl md:text-xl lg:text-2xl font-black tracking-tight leading-tight text-foreground break-words text-center md:text-left">
                            每日歌曲推荐
                        </h1>
                    </div>

                    <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-3xl font-medium text-center md:text-left">
                        根据您的品味每日更新，发现更多心动旋律。
                    </p>

                    <div className="pt-2 md:pt-3 w-full flex justify-center md:justify-start">
                        <Button
                            onClick={handlePlayAll}
                            className="h-12 md:h-11 flex-1 md:flex-none md:px-7 rounded-2xl md:rounded-full gap-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all font-bold shadow-lg shadow-foreground/10 text-[15px] md:text-sm"
                        >
                            <Play className="h-5 w-5 md:h-4 md:w-4 fill-current" />
                            播放全部
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-1 pt-2 md:pt-4">
                {/* 歌单内搜索 */}
                <div className="relative px-1 md:px-0 pb-2">
                    <Search className="absolute left-4 md:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        placeholder="搜索歌单内歌曲..."
                        className="w-full h-10 pl-10 pr-9 md:pl-9 md:pr-9 rounded-xl bg-accent/40 border border-border/40 text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                    {searchKeyword && (
                        <button
                            onClick={() => setSearchKeyword("")}
                            className="absolute right-4 md:right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted-foreground/10 text-muted-foreground/60 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* 桌面端表头，移动端隐藏 */}
                <div className="hidden md:flex items-center px-4 py-3 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-t border-b border-border/40 mb-2">
                    <span className="w-12 text-center">#</span>
                    <span className="flex-[2.5] px-4">标题</span>
                    <span className="flex-[1.5] px-4 hidden lg:block">专辑</span>
                    <span className="flex-1 px-4 hidden md:block">歌手</span>
                </div>

                {filteredSongs.length === 0 && searchKeyword.trim() && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                        <Search className="h-8 w-8 mb-3 opacity-40" />
                        <p className="text-sm font-medium">未找到匹配的歌曲</p>
                    </div>
                )}

                <div className="space-y-[1px]">
                    {filteredSongs.map((song, index) => {
                        const track = discoveryService.convertToTrack(song)
                        const isCurrent = currentTrack?.id === track.id && currentTrack?.source === track.source
                        return (
                            <div
                                key={track.id}
                                onClick={() => handlePlayTrack(song)}
                                className={`flex items-center px-2 py-3 md:px-4 md:py-3 rounded-xl transition-all duration-200 group cursor-pointer border border-transparent ${isCurrent ? 'bg-primary/5 md:bg-primary/5 border-primary/10' : 'hover:bg-accent/40 active:bg-accent/60 md:active:bg-transparent'
                                    }`}
                            >
                                {/* 移动端隐藏序号 */}
                                <div className="w-10 md:w-12 hidden md:flex items-center justify-center">
                                    {isCurrent && isPlaying ? (
                                        <div className="flex items-end gap-[2px] h-3.5 mb-0.5">
                                            <div className="w-[3px] bg-primary animate-[music-bar-1_0.8s_ease-in-out_infinite]" />
                                            <div className="w-[3px] bg-primary animate-[music-bar-2_0.8s_ease-in-out_infinite]" />
                                            <div className="w-[3px] bg-primary animate-[music-bar-3_0.8s_ease-in-out_infinite]" />
                                        </div>
                                    ) : (
                                        <span className={`text-[13px] font-bold tracking-tighter ${isCurrent ? 'text-primary' : 'text-muted-foreground/30'} group-hover:hidden transition-colors`}>
                                            {index + 1}
                                        </span>
                                    )}
                                    <span className="hidden group-hover:flex items-center justify-center text-foreground/80">
                                        <Play className={`h-4 w-4 ${isCurrent ? 'text-primary' : ''} fill-current`} />
                                    </span>
                                </div>

                                {/* 列表项主体信息 */}
                                <div className="flex-[4] md:flex-[2.5] px-2 md:px-4 min-w-0 flex items-center gap-3 md:gap-4 pl-2 md:pl-0">
                                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-md md:rounded-lg overflow-hidden flex-shrink-0 shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md bg-muted">
                                        <AsyncImage src={track.picUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2 md:pr-0 text-left">
                                        <h4 className={`font-bold text-[14px] md:text-[15px] truncate transition-colors leading-snug ${isCurrent ? 'text-primary' : 'text-foreground group-hover:text-primary'
                                            }`}>
                                            {track.name}
                                        </h4>
                                        <div className="text-[12px] md:text-[12px] text-muted-foreground/80 truncate md:hidden mt-0.5 block">
                                            {track.artists}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-[1.5] px-4 hidden lg:block text-sm text-muted-foreground/60 truncate font-medium">
                                    {track.album}
                                </div>

                                <div className="flex-1 px-4 hidden md:block text-sm text-muted-foreground/80 truncate font-bold">
                                    {track.artists}
                                </div>

                            </div>
                        )
                    })}
                </div>
            </div>

            <style jsx global>{`
                @keyframes music-bar-1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
                @keyframes music-bar-2 { 0%, 100% { height: 14px; } 50% { height: 6px; } }
                @keyframes music-bar-3 { 0%, 100% { height: 8px; } 50% { height: 16px; } }
            `}</style>
        </div>
    )
}

function ListMusicInIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 15V6" />
            <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            <path d="M12 12H3" />
            <path d="M16 6H3" />
            <path d="M12 18H3" />
        </svg>
    )
}

function PlayInIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
    )
}