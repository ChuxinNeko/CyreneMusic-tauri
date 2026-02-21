"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { discoveryService, RecommendData, Toplist } from "@/lib/services/discoveryService"
import { accountService } from "@/lib/services/accountService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { Loader2, Music2, Trophy, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GreetingHeader } from "@/components/discovery/GreetingHeader"
import { HeroSection } from "@/components/discovery/HeroSection"
import { PlaylistDetailView, DailySongsDetailView } from "@/components/discovery/PlaylistDetailView"
import { AsyncImage } from "@/components/common/AsyncImage"
import { playerService } from "@/lib/services/playerService"
import { toast } from "sonner"

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("recommend")
  const [isBound, setIsBound] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [recommendData, setRecommendData] = useState<RecommendData | null>(null)
  const [toplists, setToplists] = useState<Toplist[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | number | null>(null)
  const [isDailyView, setIsDailyView] = useState<boolean>(false)
  const { token } = useAuthStore()

  const checkBinding = useCallback(async () => {
    if (!token) {
      setIsBound(false)
      setActiveTab("leaderboard")
      setLoading(false)
      return
    }

    try {
      const bound = await accountService.isNeteaseBound(token)
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
  }, [token])

  const fetchData = useCallback(async () => {
    if (!isBound || !token) {
      setLoading(true)
      try {
        const toplistRes = await discoveryService.getToplists()
        setToplists(toplistRes)
      } catch (error) {
        console.error("Fetch toplists failed:", error)
      }
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [toplistRes, recommendRes] = await Promise.all([
        discoveryService.getToplists(),
        discoveryService.getRecommendForYou(token)
      ])
      setToplists(toplistRes)
      setRecommendData(recommendRes)
    } catch (error) {
      console.error("Fetch discovery data failed:", error)
    }
    setLoading(false)
  }, [isBound, token])

  useEffect(() => {
    checkBinding()
  }, [checkBinding])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handlePlayDaily = useCallback(() => {
    if (!recommendData?.dailySongs?.length) return
    const tracks = recommendData.dailySongs.map(discoveryService.convertToTrack)
    playerService.playTrack(tracks[0])
    // The player service currently doesn't have a direct setQueue exposed in the same way 
    // as our internal state, but it handles it through usePlayerStore.getState().setQueue
    // Let's assume playTrack handles the basic play, we'll refine queue later if needed.
    toast.success("开始播放每日推荐")
  }, [recommendData])

  const handlePlayFm = useCallback(() => {
    if (!recommendData?.fm?.length) return
    const tracks = recommendData.fm.map(discoveryService.convertToTrack)
    playerService.playTrack(tracks[0])
    toast.success("开始播放私人 FM")
  }, [recommendData])

  const handleNextFm = useCallback(() => {
    playerService.playNext()
  }, [])

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
    <div className="h-full px-4 pt-2 pb-8 lg:px-8 max-w-7xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 py-2">
          {!selectedPlaylistId && !isDailyView ? (
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
          ) : null}
        </div>

        <TabsContent value="recommend" className="border-none p-0 outline-none focus-visible:ring-0">
          {selectedPlaylistId ? (
            <PlaylistDetailView id={selectedPlaylistId} onBack={() => setSelectedPlaylistId(null)} token={token || undefined} />
          ) : isDailyView && recommendData ? (
            <DailySongsDetailView
              songs={recommendData.dailySongs}
              onBack={() => setIsDailyView(false)}
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
            <PlaylistDetailView id={selectedPlaylistId} onBack={() => setSelectedPlaylistId(null)} token={token || undefined} />
          ) : (
            <LeaderboardView toplists={toplists} onPlaylistClick={setSelectedPlaylistId} />
          )}
        </TabsContent>
      </Tabs>
    </div>
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
                <div className="relative h-14 w-14 rounded-lg overflow-hidden shadow-sm">
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

function LeaderboardView({ toplists, onPlaylistClick }: { toplists: Toplist[], onPlaylistClick: (id: string | number) => void }) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {toplists.slice(0, 4).map((list) => (
          <Card key={list.id} onClick={() => onPlaylistClick(list.id)} className="overflow-hidden border-none bg-accent/20 hover:bg-accent/30 transition-colors group cursor-pointer">
            <div className="flex h-full">
              <div className="relative w-40 sm:w-48 aspect-square flex-shrink-0 shadow-lg">
                <AsyncImage src={list.coverImgUrl} alt={list.name} className="h-full w-full" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <Button size="icon" className="rounded-full h-12 w-12 shadow-xl">
                    <Play className="h-6 w-6 fill-current" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col justify-center min-w-0">
                <h3 className="text-2xl font-bold mb-4">{list.name}</h3>
                <div className="space-y-3">
                  {list.tracks.slice(0, 3).map((track, idx) => (
                    <div key={track.id} className="flex items-center gap-3 text-sm group/item">
                      <span className="font-bold text-muted-foreground/50 w-4">{idx + 1}</span>
                      <span className="flex-1 font-medium truncate group-hover/item:text-primary transition-colors">{track.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{track.artists}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <section className="pt-6">
        <h2 className="text-2xl font-bold mb-6">更多榜单</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {toplists.slice(4).map((list) => (
            <MusicCard
              key={list.id}
              title={list.name}
              subtitle={list.description || "榜单"}
              image={list.coverImgUrl}
              aspectRatio="square"
              onClick={() => onPlaylistClick(list.id)}
            />
          ))}
        </div>
      </section>
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
