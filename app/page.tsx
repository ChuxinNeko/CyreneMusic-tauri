"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { discoveryService, RecommendData, Toplist } from "@/lib/services/discoveryService"
import { accountService } from "@/lib/services/accountService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { Loader2, Music2, Trophy, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GreetingHeader } from "@/components/discovery/GreetingHeader"
import { HeroSection } from "@/components/discovery/HeroSection"
import { LeaderboardHero } from "@/components/discovery/LeaderboardHero"
import { PlaylistDetailView, DailySongsDetailView } from "@/components/discovery/PlaylistDetailView"
import { AsyncImage } from "@/components/common/AsyncImage"
import { playerService } from "@/lib/services/playerService"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { toast } from "sonner"

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedPlaylistId = searchParams.get("playlist")
  const isDailyView = searchParams.get("view") === "daily"

  const setSelectedPlaylistId = (id: string | number | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (id) {
      params.set("playlist", id.toString())
      params.delete("view")
    } else {
      params.delete("playlist")
    }
    router.push(`/?${params.toString()}`)
  }

  const setIsDailyView = (show: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (show) {
      params.set("view", "daily")
      params.delete("playlist")
    } else {
      params.delete("view")
    }
    router.push(`/?${params.toString()}`)
  }

  const [activeTab, setActiveTab] = useState<string>("recommend")
  const [isBound, setIsBound] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [recommendData, setRecommendData] = useState<RecommendData | null>(null)
  const [toplists, setToplists] = useState<Toplist[]>([])
  const [randomTracks, setRandomTracks] = useState<any[]>([])
  const { token } = useAuthStore()
  const toplistSource = useLayoutStore(s => s.toplistSource)
  const recommendSource = useLayoutStore(s => s.recommendSource)

  const checkBinding = useCallback(async () => {
    if (!token) {
      setIsBound(false)
      setActiveTab("leaderboard")
      setLoading(false)
      return
    }

    try {
      const bindings = await accountService.getBindings(token)
      const bound = recommendSource === 'qq'
        ? !!bindings?.qq?.bound
        : !!bindings?.netease?.bound
      setIsBound(bound)
      if (!bound) {
        setActiveTab("leaderboard")
      } else {
        setActiveTab("recommend")
      }
    } catch (error) {
      console.error("Check binding failed:", error)
    }
    setLoading(false)
  }, [token, recommendSource])

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    if (forceRefresh) setIsRefreshing(true)
    else setLoading(true)
    
    if (!isBound || !token) {
      try {
        const toplistRes = await discoveryService.getToplists(forceRefresh, toplistSource)
        setToplists(toplistRes)
      } catch (error) {
        console.error("Fetch toplists failed:", error)
      }
      setLoading(false)
      setIsRefreshing(false)
      return
    }

    try {
      const [toplistRes, recommendRes] = await Promise.all([
        discoveryService.getToplists(forceRefresh, toplistSource),
        discoveryService.getRecommendForYou(token, forceRefresh, recommendSource)
      ])
      setToplists(toplistRes)
      setRecommendData(recommendRes)
    } catch (error) {
      console.error("Fetch discovery data failed:", error)
    }
    setLoading(false)
    setIsRefreshing(false)
  }, [isBound, token, toplistSource, recommendSource])

  useEffect(() => {
    checkBinding()
  }, [checkBinding])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 用户切换榜单来源时，清空随机曲目并强制刷新
  useEffect(() => {
    setRandomTracks([])
  }, [toplistSource])

  const handleRefresh = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    if (toplists.length > 0 && randomTracks.length === 0) {
      // Pick random tracks from all toplists
      const allTracks = toplists.flatMap(list => list.tracks)
      if (allTracks.length > 0) {
        const shuffled = [...allTracks].sort(() => 0.5 - Math.random())
        setRandomTracks(shuffled.slice(0, 10))
      }
    }
  }, [toplists, randomTracks.length])

  const handlePlayDaily = useCallback(() => {
    if (!recommendData?.dailySongs?.length) return
    const tracks = recommendData.dailySongs.map(discoveryService.convertToTrack)
    playerService.playWithQueue(tracks[0], tracks)
    toast.success("开始播放每日推荐")
  }, [recommendData])

  const handlePlayFm = useCallback(() => {
    if (!recommendData?.fm?.length) return
    const tracks = recommendData.fm.map(discoveryService.convertToTrack)
    playerService.playWithQueue(tracks[0], tracks)
    toast.success("开始播放私人 FM")
  }, [recommendData])

  const handleNextFm = useCallback(() => {
    playerService.playNext()
  }, [])

  const handlePlayRandomCharts = useCallback(() => {
    if (!randomTracks.length) return
    const tracks = randomTracks.map(discoveryService.convertToTrack)
    // Shuffle again for better experience
    const shuffled = [...tracks].sort(() => 0.5 - Math.random())
    playerService.playWithQueue(shuffled[0], shuffled)
    toast.success("开始随机播放榜单精选")
  }, [randomTracks])

  // Optimization: Show UI as long as we have some data, even if loading other parts
  const shouldShowContent = toplists.length > 0 || (isBound && recommendData !== null)

  if (loading && !shouldShowContent) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">正在探索音乐世界...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full pb-8 lg:px-8 max-w-7xl mx-auto ${(selectedPlaylistId || isDailyView) ? 'px-0 pt-0' : 'px-4 pt-2'}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className={`flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 ${(!selectedPlaylistId && !isDailyView) ? 'py-2' : 'hidden'}`}>
          {!selectedPlaylistId && !isDailyView ? (
            <div className="flex items-center w-full justify-between pr-2">
              <TabsList className="bg-muted/50 p-1">
                {isBound && (
                  <TabsTrigger value="recommend" className="gap-2 px-6">
                    <Music2 className="h-4 w-4" />
                    为你推荐
                  </TabsTrigger>
                )}
                <TabsTrigger value="leaderboard" className="gap-2 px-6">
                  <Trophy className="h-4 w-4" />
                  全部榜单
                </TabsTrigger>
              </TabsList>
              <Button
                  variant="ghost" 
                  size="icon" 
                  onClick={handleRefresh} 
                  disabled={isRefreshing}
                  className="rounded-full h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  title="刷新数据"
              >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          ) : null}
        </div>

        <TabsContent value="recommend" className="border-none p-0 outline-none focus-visible:ring-0">
          {selectedPlaylistId ? (
            <PlaylistDetailView id={selectedPlaylistId} onBack={() => router.back()} token={token || undefined} toplistSource={recommendSource} playlistType="playlist" />
          ) : isDailyView && recommendData ? (
            <DailySongsDetailView
              songs={recommendData.dailySongs}
              onBack={() => router.back()}
            />
          ) : recommendData ? (
            <>
              <GreetingHeader />
              <HeroSection
                dailySongs={recommendData.dailySongs}
                fmSongs={recommendData.fm}
                onDailyClick={() => setIsDailyView(true)}
                onPlayDaily={handlePlayDaily}
                onPlayFm={handlePlayFm}
                onNextFm={handleNextFm}
              />
              <RecommendView data={recommendData} onPlaylistClick={setSelectedPlaylistId} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Music2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">暂无推荐内容</h3>
              <p className="text-sm text-muted-foreground">绑定网易云账号以获取个性化推荐。</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="border-none p-0 outline-none">
          {selectedPlaylistId ? (
            <PlaylistDetailView id={selectedPlaylistId} onBack={() => router.back()} token={token || undefined} toplistSource={toplistSource} playlistType="toplist" />
          ) : (
            <LeaderboardView
              toplists={toplists}
              onPlaylistClick={setSelectedPlaylistId}
              randomTracks={randomTracks}
              onPlayRandom={handlePlayRandomCharts}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}

function RecommendView({ data, onPlaylistClick }: { data: RecommendData, onPlaylistClick: (id: string | number) => void }) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {data.dailyPlaylists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">日推歌单</h2>
              <p className="text-sm text-muted-foreground">根据您的品味每日更新。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {data.dailyPlaylists.map((item: any) => (
              <MusicCard
                key={item.id}
                title={item.name}
                subtitle={item.copywriter || "今日精选"}
                image={item.picUrl}
                onClick={() => onPlaylistClick(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {data.personalizedPlaylists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">猜你喜欢</h2>
              <p className="text-sm text-muted-foreground">发现更多心动旋律。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {data.personalizedPlaylists.map((item: any) => (
              <MusicCard
                key={item.id}
                title={item.name}
                subtitle={`${Math.floor(item.playCount / 10000)}万播放`}
                image={item.picUrl}
                onClick={() => onPlaylistClick(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {data.personalizedNewsongs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">最新歌曲</h2>
              <p className="text-sm text-muted-foreground">今日份的新歌速递。</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.personalizedNewsongs.map((item: any) => (
              <div key={item.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-all cursor-pointer border border-transparent hover:border-border">
                <div
                  className="relative h-14 w-14 rounded-lg overflow-hidden shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    const track = discoveryService.convertToTrack(item)
                    playerService.playWithQueue(track, [track])
                  }}
                >
                  <AsyncImage src={item.picUrl} alt={item.name} className="h-full w-full" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-6 w-6 text-white fill-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{item.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.song?.artists?.map((a: any) => a.name).join("/") || item.copywriter}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function LeaderboardView({ toplists, onPlaylistClick, randomTracks, onPlayRandom }: { toplists: Toplist[], onPlaylistClick: (id: string | number) => void, randomTracks: any[], onPlayRandom: () => void }) {
  if (toplists.length === 0) return null;

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <LeaderboardHero randomTracks={randomTracks} onPlayAll={onPlayRandom} />


      {/* 1. Toplist Sections with Horizontal Scrolling Tracks */}
      <div className="space-y-20">
        {toplists.slice(0, 10).map((list) => (
          <ToplistSection key={list.id} toplist={list} onPlaylistClick={onPlaylistClick} />
        ))}
      </div>

    </div>
  )
}

function ToplistSection({ toplist, onPlaylistClick }: { toplist: Toplist, onPlaylistClick: (id: string | number) => void }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <h2 className="text-2xl font-extrabold tracking-tight">{toplist.name}</h2>
        </div>
        <Button
          variant="ghost"
          className="rounded-full text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10"
          onClick={() => onPlaylistClick(toplist.id)}
        >
          查看全部
        </Button>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-6 pb-4">
          {toplist.tracks.slice(0, 12).map((track, index) => (
            <ToplistTrackCard
              key={track.id}
              track={track}
              rank={index + 1}
              onClick={() => {
                const tracks = toplist.tracks.map(t => discoveryService.convertToTrack(t))
                const currentTrack = discoveryService.convertToTrack(track)
                playerService.playWithQueue(currentTrack, tracks)
              }}
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  )
}

function ToplistTrackCard({ track, rank, onClick }: { track: any, rank: number, onClick: () => void }) {
  const isTopThree = rank <= 3;

  return (
    <div
      className="group w-[180px] flex-shrink-0 cursor-pointer space-y-3"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="relative aspect-square rounded-[1.5rem] overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300">
        <AsyncImage
          src={track.picUrl}
          alt={track.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Rank Badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-xl backdrop-blur-md border ${isTopThree
          ? "bg-primary/90 border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
          : "bg-black/60 border-white/10"
          } transition-transform duration-300 group-hover:scale-110 z-10`}>
          <span className={`text-xs font-black tracking-tighter ${isTopThree ? "text-primary-foreground" : "text-white"}`}>
            #{rank}
          </span>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-white rounded-full p-4 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
            <Play className="h-6 w-6 text-black fill-current" />
          </div>
        </div>
      </div>

      <div className="px-2">
        <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors mb-0.5">{track.name}</h4>
        <p className="text-xs text-muted-foreground truncate">{track.artists}</p>
      </div>
    </div>
  )
}

function MusicCard({ title, subtitle, image, onClick, aspectRatio = "square" }: { title: string, subtitle: string, image: string, onClick?: () => void, aspectRatio?: "square" | "portrait" }) {
  return (
    <div className="group space-y-3 cursor-pointer" onClick={onClick}>
      <div className="relative overflow-hidden rounded-2xl shadow-md group-hover:shadow-xl transition-all duration-300">
        <AsyncImage
          src={image}
          alt={title}
          aspectRatio={aspectRatio}
          imageClassName="transition-all duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <Button size="icon" className="rounded-full h-12 w-12 shadow-lg scale-90 group-hover:scale-100 transition-transform">
              <Play className="h-6 w-6 fill-current" />
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-sm leading-tight truncate px-1 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-xs text-muted-foreground truncate px-1">{subtitle}</p>
      </div>
    </div>
  )
}
