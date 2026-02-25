"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { albumService, AlbumDetailInfo } from "@/lib/services/albumService"
import { Track } from "@/lib/models/track"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Loader2, Music2, Play, MoreHorizontal, Disc, ArrowLeft } from "lucide-react"
import { playerService } from "@/lib/services/playerService"

export default function AlbumDetailPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const albumId = searchParams.get('id') as string

    const [albumData, setAlbumData] = React.useState<AlbumDetailInfo | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [isDescExpanded, setIsDescExpanded] = React.useState(false)

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

    const renderTrackList = (tracks: any[], albumInfo: any) => {
        if (tracks.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
                    <Music2 className="h-12 w-12 mb-4 opacity-20" />
                    <p>暂无歌曲</p>
                </div>
            )
        }

        const formattedTracks: Track[] = tracks.map(song => ({
            id: song.id,
            name: song.name,
            artists: song.ar?.map((a: any) => a.name).join(', ') || song.artists?.map((a: any) => a.name).join(', ') || '',
            album: albumInfo.name,
            picUrl: song.al?.picUrl || albumInfo.picUrl || '',
            source: 'netease',
        }));

        return (
            <div className="flex flex-col gap-1 pb-10 mt-4">
                <div className="grid grid-cols-[48px_1fr_1fr_48px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="text-center">#</div>
                    <div>标题</div>
                    <div>歌手</div>
                    <div className="text-right pr-4"></div>
                </div>
                <Separator className="mb-2" />
                {formattedTracks.map((track, index) => {
                    const key = `album-track-${track.id}`;

                    return (
                        <div
                            key={key}
                            className="grid grid-cols-[48px_1fr_1fr_48px] gap-4 px-4 py-2 items-center rounded-lg hover:bg-accent/50 group transition-all cursor-pointer"
                            onDoubleClick={() => {
                                playerService.playWithQueue(track, formattedTracks);
                            }}
                        >
                            <div className="flex justify-center items-center relative">
                                <span className="text-sm text-muted-foreground group-hover:opacity-0">{index + 1}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 absolute opacity-0 group-hover:opacity-100 bg-primary/10 hover:bg-primary/20"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        playerService.playWithQueue(track, formattedTracks)
                                    }}
                                >
                                    <Play className="h-4 w-4 text-primary fill-primary" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 flex-shrink-0 rounded bg-muted/50 overflow-hidden">
                                    {track.picUrl ? (
                                        <img src={track.picUrl} alt={track.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center">
                                            <Music2 className="h-5 w-5 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-sm truncate" title={track.name}>{track.name}</span>
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground truncate" title={track.artists}>
                                {track.artists}
                            </div>

                            <div className="flex justify-end items-center pr-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">加载专辑数据中...</p>
            </div>
        )
    }

    if (error || !albumData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
                <Disc className="h-16 w-16 text-muted-foreground/30" />
                <div className="text-xl font-medium">{error || "加载失败"}</div>
                <Button variant="outline" onClick={() => router.back()}>返回</Button>
            </div>
        )
    }

    const { album, songs } = albumData
    const coverUrl = album.picUrl || ''
    const date = album.publishTime ? new Date(album.publishTime).getFullYear() : ''

    const formattedTracks: Track[] = songs.map(song => ({
        id: song.id,
        name: song.name,
        artists: song.ar?.map((a: any) => a.name).join(', ') || song.artists?.map((a: any) => a.name).join(', ') || '',
        album: album.name,
        picUrl: song.al?.picUrl || album.picUrl || '',
        source: 'netease',
    }));

    return (
        <div className="h-full flex flex-col pt-6 overflow-hidden">
            {/* Navigation & Header Space */}
            <div className="px-4 lg:px-8 flex items-center mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-4 -ml-2">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">专辑详情</h1>
            </div>

            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="px-4 lg:px-8 pb-10">
                        {/* Album Header Profile */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 px-6 py-8 rounded-2xl bg-gradient-to-br from-accent/30 to-background border shadow-sm mb-8">
                            <div className="w-48 h-48 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border-4 border-background bg-card relative">
                                {coverUrl ? (
                                    <img src={coverUrl} alt={album.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                        <Disc className="w-16 h-16 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                                <h2 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center">
                                    {album.name}
                                </h2>
                                <p className="text-lg font-medium text-muted-foreground mb-4">
                                    {album.artist?.name || '未知歌手'}
                                </p>

                                <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground mb-4">
                                    {date && (
                                        <>
                                            <div><span className="text-foreground tracking-wide font-semibold mr-1">{date}</span></div>
                                            <div className="w-1 h-1 rounded-full bg-border" />
                                        </>
                                    )}
                                    <div><span className="text-foreground tracking-wide font-semibold mr-1">{songs.length}</span> 首歌曲</div>
                                    {album.company && (
                                        <>
                                            <div className="w-1 h-1 rounded-full bg-border" />
                                            <div>{album.company}</div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 mb-6">
                                    <Button
                                        className="rounded-full px-8 shadow-md"
                                        onClick={() => formattedTracks.length > 0 && playerService.playWithQueue(formattedTracks[0], formattedTracks)}
                                        disabled={formattedTracks.length === 0}
                                    >
                                        <Play className="h-4 w-4 mr-2" fill="currentColor" /> 播放全部
                                    </Button>
                                </div>

                                <div className="w-full">
                                    <p className={`text-sm text-muted-foreground leading-relaxed ${isDescExpanded ? '' : 'line-clamp-3'}`}>
                                        {album.description || '暂无专辑介绍'}
                                    </p>
                                    {album.description && album.description.length > 100 && (
                                        <button
                                            onClick={() => setIsDescExpanded(!isDescExpanded)}
                                            className="text-xs font-semibold text-primary mt-2 hover:underline"
                                        >
                                            {isDescExpanded ? '收起介绍' : '查看完整介绍'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Song List */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 px-2 tracking-tight">包含歌曲</h3>
                            <div className="bg-card rounded-xl border shadow-sm pb-2">
                                {renderTrackList(songs, album)}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
