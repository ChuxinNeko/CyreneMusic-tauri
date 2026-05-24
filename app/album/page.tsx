"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { albumService, AlbumDetailInfo } from "@/lib/services/albumService"
import { Track } from "@/lib/models/track"
import { Button } from "@/components/ui/button"
import { Loader2, Play, ChevronLeft, Disc } from "lucide-react"
import { playerService } from "@/lib/services/playerService"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { AsyncImage } from "@/components/common/AsyncImage"
import { MusicSource } from "@/lib/services/audioSourceService"

export default function AlbumDetailPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const albumId = searchParams.get('id') as string

    const [albumData, setAlbumData] = React.useState<AlbumDetailInfo | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [isDescExpanded, setIsDescExpanded] = React.useState(false)
    const { currentTrack, isPlaying } = usePlayerStore()

    React.useEffect(() => {
        if (!albumId) return

        setIsLoading(true)
        albumService.fetchAlbumDetail(albumId)
            .then(data => {
                if (data) {
                    setAlbumData(data)
                } else {
                    setError("未找到该专辑的信息")
                }
            })
            .catch(err => {
                setError(err.message || "加载专辑信息时发生错误")
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [albumId])

    const handleBack = () => {
        router.back()
    }

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !albumData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Disc className="h-16 w-16 text-muted-foreground/30" />
                <p className="text-muted-foreground">{error || "获取专辑详情失败"}</p>
                <Button onClick={handleBack} variant="outline" className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> 返回
                </Button>
            </div>
        )
    }

    const { album, songs } = albumData
    const coverUrl = album.picUrl || ''
    
    const formattedTracks: Track[] = songs.map(song => ({
        id: song.id,
        name: song.name,
        artists: typeof song.artists === 'string'
            ? song.artists
            : (song.ar?.map((a: any) => a.name).join(', ') || song.artists?.map((a: any) => a.name).join(', ') || ''),
        album: typeof song.album === 'string' ? song.album : (song.al?.name || album.name),
        picUrl: song.picUrl || song.al?.picUrl || album.picUrl || '',
        source: MusicSource.Netease,
        duration: (song.dt || 0) / 1000
    }));

    const handlePlayAll = () => {
        if (formattedTracks.length > 0) {
            playerService.playWithQueue(formattedTracks[0], formattedTracks)
        }
    }

    const handlePlayTrack = (track: Track) => {
        playerService.playWithQueue(track, formattedTracks)
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto px-4 sm:px-0 relative pt-[env(safe-area-inset-top)] isolate">
            {/* 移动端全宽顶部封面渐变背景 */}
            <div className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 w-screen aspect-square sm:max-h-[500px] -z-10 pointer-events-none overflow-hidden origin-top">
                <AsyncImage src={coverUrl} className="w-full h-full object-cover scale-105" lazy={false} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-background/60 to-background" />
            </div>

            {/* Action Bar / Back Button */}
            <div className="flex items-center pt-2 md:pt-0 translate-y-[20px]">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="h-8 md:-ml-2 gap-1 md:text-muted-foreground md:hover:text-foreground md:hover:bg-transparent transition-colors md:bg-transparent bg-background/40 backdrop-blur-md text-foreground rounded-full px-3 md:rounded-md md:px-2 z-20"
                >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">返回</span>
                </Button>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12 items-center md:items-start text-center md:text-left relative z-10">
                {/* 桌面端封面图区域 (移动端隐藏) */}
                <div className="hidden md:block relative md:w-44 lg:w-56 aspect-square md:rounded-2xl overflow-hidden md:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.2)] flex-shrink-0 bg-muted transition-all duration-300">
                    <AsyncImage src={coverUrl} className="w-full h-full object-cover scale-105" lazy={false} />
                </div>

                <div className="flex-1 min-w-0 space-y-4 md:space-y-3 pt-[55vw] sm:pt-[250px] md:pt-1 flex flex-col items-center md:items-start w-full px-4 md:px-0">
                    <div className="space-y-2 md:space-y-1 w-full">
                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest block text-center md:text-left hidden md:block">专辑</span>
                        <h1 className="text-2xl sm:text-3xl md:text-xl lg:text-2xl font-black tracking-tight leading-tight text-foreground break-words text-center md:text-left">
                            {album.name}
                        </h1>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-1.5 text-[13px] md:text-sm font-medium">
                        <span className="text-primary font-bold hover:underline cursor-pointer transition-colors">
                            {album.artist?.name || '未知歌手'}
                        </span>
                        {album.publishTime && (
                           <span className="text-muted-foreground/60 hidden md:inline"> · {new Date(album.publishTime).getFullYear()}</span>
                        )}
                    </div>

                    {album.description && (
                        <div className="space-y-1 group/desc">
                            <div
                                className={`relative overflow-hidden transition-all duration-500 ease-in-out ${isDescExpanded ? "max-h-[1000px] opacity-100" : "max-h-[3em] opacity-80"
                                    }`}
                            >
                                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-wrap font-medium text-center md:text-left">
                                    {album.description}
                                </p>
                            </div>
                            {album.description.length > 80 && (
                                <button
                                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                                    className="text-xs font-bold text-primary hover:underline transition-all flex items-center gap-1"
                                >
                                    {isDescExpanded ? "收起" : "更多"}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 md:gap-x-5 gap-y-2 text-xs md:text-xs font-bold text-muted-foreground/50 md:text-muted-foreground/70">
                        <div className="flex items-center gap-2 md:gap-4">
                            <span className="flex items-center gap-1">
                                <ListMusicInIcon className="h-3 w-3 md:h-3.5 md:w-3.5 hidden md:block" />
                                {songs.length} 首歌曲
                            </span>
                            {album.company && (
                                <span className="flex items-center gap-1">
                                    <span className="md:hidden">·</span>
                                    {album.company}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="pt-2 md:pt-3 w-full flex items-center justify-center md:justify-start gap-3">
                        <Button
                            onClick={handlePlayAll}
                            className="h-12 md:h-11 flex-1 md:flex-none md:px-7 rounded-2xl md:rounded-full gap-2.5 bg-foreground text-background hover:bg-foreground/90 transition-all font-bold shadow-lg shadow-foreground/10 text-[15px] md:text-sm"
                            disabled={formattedTracks.length === 0}
                        >
                            <Play className="h-5 w-5 md:h-4 md:w-4 fill-current" />
                            播放全部
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-1 pt-2 md:pt-4">
                {/* 桌面端表头，移动端隐藏 */}
                <div className="hidden md:flex items-center px-4 py-3 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-t border-b border-border/40 mb-2">
                    <span className="w-12 text-center">#</span>
                    <span className="flex-[2.5] px-4">标题</span>
                    <span className="flex-1 px-4 hidden md:block">歌手</span>
                </div>

                <div className="space-y-[1px]">
                    {formattedTracks.map((track, index) => {
                        const isCurrent = currentTrack?.id === track.id && currentTrack?.source === 'netease'
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

