"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { artistService, ArtistDetailInfo } from "@/lib/services/artistService"
import { Track } from "@/lib/models/track"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Music2, Play, MoreHorizontal, User, Disc, ArrowLeft } from "lucide-react"
import { playerService } from "@/lib/services/playerService"

export default function ArtistDetailPage() {
    // const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const artistId = searchParams.get('id') as string

    const [artistData, setArtistData] = React.useState<ArtistDetailInfo | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [isDescExpanded, setIsDescExpanded] = React.useState(false)

    React.useEffect(() => {
        if (!artistId) return

        setIsLoading(true)
        artistService.fetchArtistDetail(artistId)
            .then(data => {
                if (data) {
                    setArtistData(data)
                } else {
                    setError("未找到该歌手的信息")
                }
            })
            .catch(err => {
                setError(err.message || "加载歌手信息时发生错误")
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [artistId])

    const renderTrackList = (tracks: Track[]) => {
        if (tracks.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
                    <Music2 className="h-12 w-12 mb-4 opacity-20" />
                    <p>暂无歌曲</p>
                </div>
            )
        }

        return (
            <div className="flex flex-col gap-1 pb-10 mt-4">
                <div className="grid grid-cols-[48px_1fr_1fr_48px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="text-center">#</div>
                    <div>标题</div>
                    <div>专辑</div>
                    <div className="text-right pr-4"></div>
                </div>
                <Separator className="mb-2" />
                {tracks.map((track, index) => {
                    const key = `artist-track-${track.id}`;

                    return (
                        <div
                            key={key}
                            className="grid grid-cols-[48px_1fr_1fr_48px] gap-4 px-4 py-2 items-center rounded-lg hover:bg-accent/50 group transition-all cursor-pointer"
                            onDoubleClick={() => {
                                playerService.playWithQueue(track, tracks);
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
                                        playerService.playWithQueue(track, tracks)
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

                            <div className="text-sm text-muted-foreground truncate" title={track.album}>
                                {track.album}
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

    const renderAlbumGrid = (albums: any[]) => {
        if (albums.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
                    <Disc className="h-12 w-12 mb-4 opacity-20" />
                    <p>暂无专辑</p>
                </div>
            )
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pb-10 mt-4 px-4">
                {albums.map((album) => {
                    const pic = album.picUrl || album.coverImgUrl;
                    const date = album.publishTime ? new Date(album.publishTime).getFullYear() : '';
                    return (
                        <div
                            key={`artist-album-${album.id}`}
                            className="flex flex-col gap-3 group cursor-pointer"
                            onClick={() => {
                                router.push(`/album?id=${album.id}`)
                            }}
                        >
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted shadow-sm transition-transform group-hover:scale-105 duration-300">
                                {pic ? (
                                    <img src={pic} alt={album.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                        <Disc className="h-12 w-12 text-muted-foreground/30" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button size="icon" className="h-10 w-10 rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform">
                                        <Play className="h-5 w-5 ml-1" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h4 className="font-semibold text-sm truncate w-full" title={album.name}>{album.name}</h4>
                                <div className="text-xs text-muted-foreground flex items-center justify-between mt-1">
                                    <span className="truncate flex-1" title={album.company}>{date ? `${date} · ` : ''}{album.company || '未知唱片'}</span>
                                </div>
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
                <p className="text-muted-foreground">加载歌手数据中...</p>
            </div>
        )
    }

    if (error || !artistData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
                <User className="h-16 w-16 text-muted-foreground/30" />
                <div className="text-xl font-medium">{error || "加载失败"}</div>
                <Button variant="outline" onClick={() => router.back()}>返回</Button>
            </div>
        )
    }

    const { artist, songs, albums } = artistData
    const coverUrl = artist.img1v1Url || artist.picUrl || ''

    return (
        <div className="h-full flex flex-col pt-6 overflow-hidden">
            {/* Navigation & Header Space */}
            <div className="px-4 lg:px-8 flex items-center mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-4 -ml-2">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-semibold tracking-tight">歌手详情</h1>
            </div>

            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="px-4 lg:px-8 pb-10">
                        {/* Artist Header Profile */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 px-6 py-8 rounded-2xl bg-gradient-to-br from-accent/30 to-background border shadow-sm mb-8">
                            <div className="w-40 h-40 flex-shrink-0 rounded-full overflow-hidden shadow-lg border-4 border-background bg-card relative">
                                {coverUrl ? (
                                    <img src={coverUrl} alt={artist.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                        <User className="w-16 h-16 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                                <h2 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center">
                                    {artist.name}
                                    {artist.alias && artist.alias.length > 0 && (
                                        <span className="text-lg font-medium text-muted-foreground ml-3 font-normal tracking-normal pt-1">
                                            ({artist.alias[0]})
                                        </span>
                                    )}
                                </h2>

                                <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground mb-4">
                                    <div><span className="text-foreground tracking-wide font-semibold mr-1">{artist.musicSize || songs.length}</span> 首歌曲</div>
                                    <div className="w-1 h-1 rounded-full bg-border" />
                                    <div><span className="text-foreground tracking-wide font-semibold mr-1">{artist.albumSize || albums.length}</span> 张专辑</div>
                                    {artist.mvSize ? (
                                        <>
                                            <div className="w-1 h-1 rounded-full bg-border" />
                                            <div><span className="text-foreground tracking-wide font-semibold mr-1">{artist.mvSize}</span> MVs</div>
                                        </>
                                    ) : null}
                                </div>

                                <div className="w-full">
                                    <p className={`text-sm text-muted-foreground leading-relaxed ${isDescExpanded ? '' : 'line-clamp-3'}`}>
                                        {artist.briefDesc || '该歌手暂无介绍'}
                                    </p>
                                    {artist.briefDesc && artist.briefDesc.length > 100 && (
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

                        {/* Artist Data Tabs */}
                        <Tabs defaultValue="songs" className="w-full">
                            <TabsList className="mb-6 bg-muted/50 p-1 rounded-lg inline-flex h-10 items-center justify-center">
                                <TabsTrigger value="songs" className="px-8 rounded-md">
                                    热门歌曲
                                </TabsTrigger>
                                <TabsTrigger value="albums" className="px-8 rounded-md">
                                    专辑
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="songs" className="m-0 border-none outline-none">
                                {renderTrackList(songs)}
                            </TabsContent>

                            <TabsContent value="albums" className="m-0 border-none outline-none">
                                {renderAlbumGrid(albums)}
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
