"use client"

import { useState, useEffect } from "react"
import { Play, ChevronLeft, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AsyncImage } from "@/components/common/AsyncImage"
import { discoveryService, PlaylistDetail } from "@/lib/services/discoveryService"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist, PlaylistTrack } from "@/lib/models/playlist"
import { playerService } from "@/lib/services/playerService"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Track } from "@/lib/models/track"
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
}

export function PlaylistDetailView({ id, onBack, token, type = 'discovery', onRemoveLocally }: PlaylistDetailViewProps) {
    const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const { currentTrack, isPlaying } = usePlayerStore()

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
                        tracks: tracks.map((t: PlaylistTrack) => ({
                            id: t.trackId,
                            name: t.name,
                            artists: t.artists,
                            album: t.album,
                            picUrl: t.picUrl,
                            source: t.source,
                            duration: 0
                        })),
                        createTime: 0,
                        updateTime: 0,
                        tags: []
                    })
                }
            } else {
                const data = await discoveryService.getPlaylistDetail(id, 200, token)
                setPlaylist(data)
            }
            setLoading(false)
        }
        fetchDetail()
    }, [id, token, type])

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
            const tracks: Track[] = playlist.tracks.map(t => discoveryService.convertToTrack({
                ...t,
                source: (t as any).source || 'netease'
            }))
            playerService.playWithQueue(tracks[0], tracks)
        }
    }

    const handlePlayTrack = (track: any) => {
        const tracks: Track[] = playlist.tracks.map(t => discoveryService.convertToTrack({
            ...t,
            source: (t as any).source || 'netease'
        }))
        const trackObj = discoveryService.convertToTrack({
            ...track,
            source: track.source || 'netease'
        })
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
        <div className="space-y-4 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto px-4 sm:px-0">
            {/* Action Bar / Back Button */}
            <div className="flex items-center">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-8 -ml-2 gap-1 text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">返回</span>
                </Button>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
                <div className="relative w-44 sm:w-52 lg:w-56 aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.2)] flex-shrink-0 bg-muted">
                    <AsyncImage src={playlist.coverImgUrl} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0 space-y-3 pt-1">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">歌单</span>
                        <h1 className="text-xl lg:text-2xl font-black tracking-tight leading-[1.2] text-foreground break-words">
                            {playlist.name}
                        </h1>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">由</span>
                        <span className="font-bold text-foreground/80 hover:text-primary cursor-pointer transition-colors">
                            {playlist.creator}
                        </span>
                        <span className="text-muted-foreground">创建</span>
                    </div>

                    {playlist.description && (
                        <div className="space-y-1 group/desc">
                            <div
                                className={`relative overflow-hidden transition-all duration-500 ease-in-out ${isDescriptionExpanded ? "max-h-[1000px] opacity-100" : "max-h-[3em] opacity-80"
                                    }`}
                            >
                                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-wrap font-medium">
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

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-muted-foreground/70">
                        {playlist.tags && playlist.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground/30 font-normal">#</span>
                                <span>{playlist.tags.join(' / ')}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <ListMusicInIcon className="h-3.5 w-3.5" />
                                {playlist.trackCount} 首
                            </span>
                            <span className="flex items-center gap-1.5">
                                <PlayInIcon className="h-3 w-3" />
                                {formatPlayCount(playlist.playCount)} 次播放
                            </span>
                        </div>
                    </div>

                    <div className="pt-3 flex items-center gap-3">
                        <Button
                            onClick={handlePlayAll}
                            className="h-11 px-7 rounded-full gap-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all font-bold shadow-lg shadow-foreground/10"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            播放全部
                        </Button>

                        {type === 'personal' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                title="删除歌单"
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-1 pt-4">
                <div className="flex items-center px-4 py-3 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-t border-b border-border/40 mb-2">
                    <span className="w-12 text-center">#</span>
                    <span className="flex-[2.5] px-4">标题</span>
                    <span className="flex-[1.5] px-4 hidden lg:block">专辑</span>
                    <span className="flex-1 px-4 hidden md:block">歌手</span>
                </div>

                <div className="space-y-[1px]">
                    {playlist.tracks.map((track, index) => {
                        const isCurrent = currentTrack?.id === track.id && currentTrack?.source === 'netease'
                        return (
                            <div
                                key={track.id}
                                onClick={() => handlePlayTrack(track)}
                                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer border border-transparent ${isCurrent ? 'bg-primary/5 border-primary/10' : 'hover:bg-accent/40'
                                    }`}
                            >
                                <div className="w-12 flex items-center justify-center">
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

                                <div className="flex-[2.5] px-4 min-w-0 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md bg-muted">
                                        <AsyncImage src={track.picUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-[15px] truncate transition-colors leading-snug ${isCurrent ? 'text-primary' : 'text-foreground group-hover:text-primary'
                                            }`}>
                                            {track.name}
                                        </h4>
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
    )
}

export function DailySongsDetailView({ songs, onBack }: { songs: any[], onBack: () => void }) {
    const { currentTrack, isPlaying } = usePlayerStore()

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
        <div className="space-y-4 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto px-4 sm:px-0">
            <div className="flex items-center">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-8 -ml-2 gap-1 text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">返回</span>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
                <div className="relative w-44 sm:w-52 lg:w-56 aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.2)] flex-shrink-0 bg-primary/10 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-6xl font-black text-primary">{new Date().getDate()}</div>
                        <div className="text-sm font-bold text-primary/60">每日歌曲推荐</div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-3 pt-1">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">推荐内容</span>
                        <h1 className="text-xl lg:text-2xl font-black tracking-tight leading-[1.2] text-foreground break-words">
                            每日歌曲推荐
                        </h1>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl font-medium">
                        根据您的品味每日更新，发现更多心动旋律。
                    </p>

                    <div className="pt-3">
                        <Button
                            onClick={handlePlayAll}
                            className="h-11 px-7 rounded-full gap-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all font-bold shadow-lg shadow-foreground/10"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            播放全部
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-1 pt-4">
                <div className="flex items-center px-4 py-3 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-t border-b border-border/40 mb-2">
                    <span className="w-12 text-center">#</span>
                    <span className="flex-[2.5] px-4">标题</span>
                    <span className="flex-[1.5] px-4 hidden lg:block">专辑</span>
                    <span className="flex-1 px-4 hidden md:block">歌手</span>
                </div>

                <div className="space-y-[1px]">
                    {songs.map((song, index) => {
                        const track = discoveryService.convertToTrack(song)
                        const isCurrent = currentTrack?.id === track.id && currentTrack?.source === track.source
                        return (
                            <div
                                key={track.id}
                                onClick={() => handlePlayTrack(song)}
                                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer border border-transparent ${isCurrent ? 'bg-primary/5 border-primary/10' : 'hover:bg-accent/40'
                                    }`}
                            >
                                <div className="w-12 flex items-center justify-center">
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

                                <div className="flex-[2.5] px-4 min-w-0 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md bg-muted">
                                        <AsyncImage src={track.picUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-[15px] truncate transition-colors leading-snug ${isCurrent ? 'text-primary' : 'text-foreground group-hover:text-primary'
                                            }`}>
                                            {track.name}
                                        </h4>
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
