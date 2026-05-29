"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { searchService } from "@/lib/services/searchService"
import { playerService } from "@/lib/services/playerService"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Track } from "@/lib/models/track"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Music2, Search, Play, MoreHorizontal, User } from "lucide-react"
import { NeteaseArtistBrief } from "@/lib/models/search"
import { useRouter } from "next/navigation"

export default function SearchPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const query = searchParams.get("q") || ""
    const [searchState, setSearchState] = React.useState(searchService.searchResult)
    const [isLoading, setIsLoading] = React.useState(false)

    React.useEffect(() => {
        if (!query) return

        setIsLoading(true)
        searchService.search(query).then(() => {
            setSearchState({ ...searchService.searchResult })
            setIsLoading(false)
        })

        const unsubscribe = searchService.subscribe(() => {
            const state = { ...searchService.searchResult }
            setSearchState(state)

            const stillLoading = state.neteaseLoading || state.qqLoading || state.kugouLoading || state.kuwoLoading || state.appleLoading || state.spotifyLoading || state.qishuiLoading
            if (!stillLoading) {
                setIsLoading(false)
            }
        })

        return () => unsubscribe()
    }, [query])

    const renderTrackList = (tracks: Track[]) => {
        if (tracks.length === 0 && !isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                    <Search className="h-12 w-12 mb-4 opacity-20" />
                    <p>未找到相关歌曲</p>
                </div>
            )
        }

        return (
            <div className="flex flex-col gap-1 pb-10">
                <div className="hidden md:grid grid-cols-[48px_1fr_1fr_1fr_48px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="text-center">#</div>
                    <div>标题</div>
                    <div>歌手</div>
                    <div>专辑</div>
                    <div className="text-right pr-4"></div>
                </div>
                <Separator className="mb-2 hidden md:block" />
                {tracks.map((track, index) => {
                    const key = `${track.source}-${track.id}`;

                    return (
                        <div
                            key={key}
                            className="grid grid-cols-[40px_1fr_40px] md:grid-cols-[48px_1fr_1fr_1fr_48px] gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-2.5 items-center rounded-lg hover:bg-accent/50 group transition-all cursor-pointer"
                            onClick={() => {
                                playerService.playWithQueue(track, [track]);
                            }}
                        >
                            <div className="flex justify-center items-center relative">
                                <span className="text-sm text-muted-foreground md:group-hover:opacity-0">{index + 1}</span>
                                <Play className="h-4 w-4 absolute opacity-0 md:group-hover:opacity-100 text-primary fill-primary hidden md:block" />
                            </div>

                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-muted shadow-sm">
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
                                    <span className="md:hidden text-xs text-muted-foreground truncate" title={track.artists}>{track.artists}</span>
                                </div>
                            </div>

                            <div className="hidden md:block text-sm text-muted-foreground truncate" title={track.artists}>
                                {track.artists}
                            </div>

                            <div className="hidden md:block text-sm text-muted-foreground truncate" title={track.album}>
                                {track.album}
                            </div>

                            <div className="flex justify-end items-center pr-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderArtistList = (artists: NeteaseArtistBrief[]) => {
        if (artists.length === 0 && !isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                    <User className="h-12 w-12 mb-4 opacity-20" />
                    <p>未找到相关歌手</p>
                </div>
            )
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 pb-10">
                {artists.map((artist) => (
                    <div
                        key={`artist-${artist.id}`}
                        className="flex flex-col items-center gap-2 md:gap-3 p-2 md:p-4 rounded-xl hover:bg-accent/50 cursor-pointer transition-all border border-transparent hover:border-border"
                        onClick={() => {
                            router.push(`/artist?id=${artist.id}`)
                        }}
                    >
                        <div className="relative w-full aspect-square rounded-full overflow-hidden bg-muted shadow-sm">
                            {artist.picUrl ? (
                                <img src={artist.picUrl} alt={artist.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <User className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                            )}
                        </div>
                        <div className="text-center w-full">
                            <h4 className="font-semibold text-sm truncate w-full" title={artist.name}>{artist.name}</h4>
                            {artist.alias && artist.alias.length > 0 && (
                                <p className="text-xs text-muted-foreground truncate w-full" title={artist.alias.join(', ')}>
                                    {artist.alias.join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col pt-6">
            <div className="px-4 lg:px-8 flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">搜索结果</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        找到关于 "{query}" 的内容
                    </p>
                </div>
                {isLoading && (
                    <div className="flex items-center gap-2 text-primary animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium italic">正在搜寻多平台...</span>
                    </div>
                )}
            </div>

            <Tabs defaultValue="netease" className="flex-1 flex flex-col min-h-0">
                <div className="px-4 lg:px-8 overflow-hidden">
                    <TabsList className="w-full justify-start h-11 bg-muted/50 p-1 rounded-lg overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                        <TabsTrigger value="netease" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            网易云 <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.neteaseResults.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="qq" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            QQ 音乐 <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.qqResults.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="kugou" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            酷狗 <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.kugouResults.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="kuwo" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            酷我 <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.kuwoResults.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="spotify" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            Spotify <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.spotifyResults.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="qishui" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            汽水音乐 <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.qishuiResults.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="artist" className="flex-none px-4 whitespace-nowrap data-[state=active]:bg-background">
                            歌手 <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">{searchState.artistResults.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 mt-4 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-4 lg:p-8 pt-0">
                            <TabsContent value="netease" className="m-0 focus-visible:ring-0">
                                {renderTrackList(searchState.neteaseResults)}
                            </TabsContent>
                            <TabsContent value="qq" className="m-0 focus-visible:ring-0">
                                {renderTrackList(searchState.qqResults)}
                            </TabsContent>
                            <TabsContent value="kugou" className="m-0 focus-visible:ring-0">
                                {renderTrackList(searchState.kugouResults)}
                            </TabsContent>
                            <TabsContent value="kuwo" className="m-0 focus-visible:ring-0">
                                {renderTrackList(searchState.kuwoResults)}
                            </TabsContent>
                            <TabsContent value="spotify" className="m-0 focus-visible:ring-0">
                                {renderTrackList(searchState.spotifyResults)}
                            </TabsContent>
                            <TabsContent value="qishui" className="m-0 focus-visible:ring-0">
                                {renderTrackList(searchState.qishuiResults)}
                            </TabsContent>
                            <TabsContent value="artist" className="m-0 focus-visible:ring-0">
                                {renderArtistList(searchState.artistResults)}
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </div>
            </Tabs>
        </div>
    )
}
