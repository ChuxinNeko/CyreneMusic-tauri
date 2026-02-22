"use client"

import { useState, useEffect } from "react"
import {
    User,
    Settings,
    Music2,
    Play,
    Clock3,
    Timer,
    Activity,
    Plus,
    ChevronRight,
    Library,
    Trophy,
    Loader2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AsyncImage } from "@/components/common/AsyncImage"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { listeningStatsService } from "@/lib/services/listeningStatsService"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist } from "@/lib/models/playlist"
import { playerService } from "@/lib/services/playerService"
import { Track } from "@/lib/models/track"
import { PlaylistDetailView } from "@/components/discovery/PlaylistDetailView"

export default function ProfilePage() {
    const { user, isLoggedIn, token } = useAuthStore()
    const [stats, setStats] = useState<any>(null)
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | number | null>(null)

    const fetchData = async () => {
        if (!isLoggedIn) return
        setLoading(true)
        try {
            const [statsData, playlistsData] = await Promise.all([
                listeningStatsService.fetchStats(),
                playlistService.getPlaylists()
            ])
            setStats(statsData)
            setPlaylists(playlistsData)
        } catch (error) {
            console.error("Failed to fetch profile data:", error)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [isLoggedIn])

    const formatListeningTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}秒`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        return `${hours}小时 ${mins}分钟`
    }

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-8 p-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative">
                    <div className="p-10 rounded-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent border border-primary/10 shadow-inner">
                        <User className="w-16 h-16 text-primary/40" />
                    </div>
                </div>
                <div className="text-center space-y-3 max-w-sm">
                    <h1 className="text-3xl font-black tracking-tighter">发现你的音乐世界</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        记录你的每一次旋律触碰。登录即可解锁个性化推荐、云端歌单并沉浸于你的音乐旅程。
                    </p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-[200px]">
                    <Button size="lg" className="rounded-full font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" onClick={() => (window as any).showAuthDialog?.()}>
                        立即开启之旅
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground/60">
                        加入 Cyrene Music，发现属于你的旋律
                    </p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    if (selectedPlaylistId) {
        return (
            <div className="h-full">
                <PlaylistDetailView
                    id={selectedPlaylistId}
                    type="personal"
                    onBack={() => {
                        setSelectedPlaylistId(null)
                        fetchData()
                    }}
                    token={token || undefined}
                />
            </div>
        )
    }

    const topPlays = stats?.playCounts?.slice(0, 10) || []

    return (
        <ScrollArea className="h-full">
            <div className="relative">


                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto pb-32"
                >
                    {/* User Profile Card */}
                    <Card className="mt-8 border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden shadow-xl ring-1 ring-white/5">
                        <div className="flex flex-col md:flex-row items-center gap-5 md:gap-6 p-5 md:p-7">
                            <Avatar className="w-16 h-16 md:w-24 md:h-24 border-2 border-background shadow-lg transition-transform hover:scale-105 duration-500">
                                <AvatarImage src={user?.avatarUrl || ''} asChild>
                                    <AsyncImage src={user?.avatarUrl || ''} />
                                </AvatarImage>
                                <AvatarFallback className="text-xl bg-muted">
                                    {user?.username?.substring(0, 1) || 'U'}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 text-center md:text-left space-y-3">
                                <div className="space-y-1">
                                    <h1 className="text-2xl md:text-3xl font-black tracking-tighter leading-tight">
                                        {user?.username || '用户'}
                                    </h1>
                                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground/80 font-medium text-xs">
                                        {user?.email || 'Cyrene 音乐探索员'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>


                    {/* Stats Tiles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                        <Card className="border border-border/40 bg-card/50 backdrop-blur-sm hover:bg-accent/10 transition-all shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">聆听时长</CardTitle>
                                <Timer className="w-4 h-4 text-primary opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black tracking-tighter">
                                    {formatListeningTime(stats?.totalListeningTime || 0)}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                    <Clock3 className="w-3 h-3" />
                                    伴你度过的每一个旋律时刻
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border border-border/40 bg-card/50 backdrop-blur-sm hover:bg-accent/10 transition-all shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">播放次数</CardTitle>
                                <Activity className="w-4 h-4 text-primary opacity-80" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black tracking-tighter">
                                    {stats?.totalPlayCount || 0} <span className="text-base font-bold text-muted-foreground/50">次</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                    <Play className="w-3 h-3 fill-current" />
                                    开启音乐旅程的总频率
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-12">
                        {/* Playlists Selection */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <Library className="w-5 h-5 text-primary" />
                                    <h2 className="text-2xl font-black tracking-tight">我的收藏</h2>
                                </div>
                                <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                {playlists.length > 0 ? (
                                    playlists.map((playlist) => (
                                        <div
                                            key={playlist.id}
                                            onClick={() => setSelectedPlaylistId(playlist.id)}
                                            className="group flex items-center gap-4 p-3 rounded-2xl bg-accent/10 border border-transparent hover:border-accent hover:bg-accent/20 transition-all cursor-pointer"
                                        >
                                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-md bg-muted ring-1 ring-border/50">
                                                <AsyncImage src={playlist.coverUrl || ''} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                                                    {playlist.name}
                                                </h4>
                                                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                                                    {playlist.trackCount} 首歌曲
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground/30 group-hover:text-primary transition-colors">
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-12 text-center bg-accent/5 rounded-3xl border-2 border-dashed border-accent">
                                        <Music2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-muted-foreground">记录你的第一个歌单</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top 10 Ranking */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 px-2">
                                <Trophy className="w-5 h-5 text-amber-500" />
                                <h2 className="text-2xl font-black tracking-tight">播放排行</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 bg-accent/5 p-6 rounded-3xl border border-accent/10">
                                {topPlays.length > 0 ? (
                                    topPlays.map((item: any, index: number) => (
                                        <div
                                            key={`${item.track_id}-${index}`}
                                            onClick={() => {
                                                const track: Track = {
                                                    id: item.track_id,
                                                    name: item.track_name,
                                                    artists: item.artists,
                                                    album: item.album || '',
                                                    picUrl: item.pic_url,
                                                    source: item.source,
                                                    duration: 0
                                                }
                                                playerService.playWithQueue(track, [track])
                                            }}
                                            className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/10 transition-all cursor-pointer border border-transparent hover:border-border/50"
                                        >
                                            <div className="relative shrink-0">
                                                <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted shadow-sm ring-1 ring-border/50">
                                                    <AsyncImage src={item.pic_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                </div>
                                                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-extrabold text-primary-foreground shadow-sm ring-2 ring-background">
                                                    {index + 1}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[13px] font-bold truncate group-hover:text-primary transition-colors leading-tight">
                                                    {item.track_name}
                                                </h4>
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <p className="text-[11px] font-medium text-muted-foreground truncate max-w-[150px]">
                                                        {item.artists}
                                                    </p>
                                                    <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-bold bg-primary/5 text-primary hover:bg-primary/10 transition-colors pointer-events-none">
                                                        {item.play_count}次
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="col-span-full text-xs text-center py-10 text-muted-foreground font-medium">
                                        听几首歌后再来吧
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </ScrollArea>
    )
}
