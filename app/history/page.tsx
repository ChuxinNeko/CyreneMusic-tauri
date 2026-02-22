"use client"

import { useState, useEffect } from "react"
import { Play, Clock3, Loader2, History as HistoryIcon, Activity, Music2, Timer } from "lucide-react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AsyncImage } from "@/components/common/AsyncImage"
import { historyService, HistoryEntry, OverallStats } from "@/lib/services/historyService"
import { playerService } from "@/lib/services/playerService"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Track } from "@/lib/models/track"
import { MusicSource } from "@/lib/services/audioSourceService"

export default function HistoryPage() {
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
    const [stats, setStats] = useState<OverallStats | null>(null)
    const [loading, setLoading] = useState(true)
    const { currentTrack, isPlaying } = usePlayerStore()

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const [entries, overallStats] = await Promise.all([
                historyService.getHistory(200),
                historyService.getStats()
            ])
            setHistoryEntries(entries)
            setStats(overallStats)
        } catch (error) {
            console.error("Failed to fetch local history:", error)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchHistory()
    }, [])

    const handlePlayTrack = (item: HistoryEntry) => {
        const track: Track = {
            id: item.id,
            name: item.name,
            artists: item.artists,
            album: item.album,
            picUrl: item.picUrl,
            source: item.source as MusicSource,
            duration: 0
        }
        playerService.playWithQueue(track, [track])
    }

    const formatListeningTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}秒`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        return `${hours}小时 ${mins}分钟`
    }

    const getTimeAgo = (timestamp: number) => {
        const now = Date.now()
        const diff = now - timestamp
        const mins = Math.floor(diff / (1000 * 60))
        const hours = Math.floor(mins / 60)
        const days = Math.floor(hours / 24)

        if (mins < 1) return "刚刚"
        if (mins < 60) return `${mins}分钟前`
        if (hours < 24) return `${hours}小时前`
        if (days < 7) return `${days}天前`
        return new Date(timestamp).toLocaleDateString()
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    if (!stats || historyEntries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60">
                <HistoryIcon className="h-16 w-16 text-muted-foreground/20" />
                <p className="text-muted-foreground tracking-tight font-medium">暂无播放历史</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto pb-32"
            >
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
                        播放历史
                    </h1>
                    <p className="text-muted-foreground lg:text-lg">
                        您的音乐足迹，本地私密存储。
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-none bg-accent/20 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                                总听歌时长
                            </CardTitle>
                            <Timer className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black tracking-tighter">{formatListeningTime(stats.totalListeningTime)}</div>
                            <CardDescription className="mt-1 font-medium">所有曲目的累计播放时长。</CardDescription>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-accent/20 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
                                播放总次数
                            </CardTitle>
                            <Activity className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black tracking-tighter">{stats.totalPlayCount} 次</div>
                            <CardDescription className="mt-1 font-medium">记录到的曲目开始播放的总次数。</CardDescription>
                        </CardContent>
                    </Card>
                </div>

                {/* List Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold tracking-tight">最近活动</h2>
                        <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                            {historyEntries.length} 条记录
                        </span>
                    </div>

                    <div className="grid gap-2">
                        {historyEntries.map((item, index) => {
                            const isCurrent = currentTrack?.id === item.id && currentTrack?.source === item.source
                            return (
                                <div
                                    key={`${item.id}-${item.source}`}
                                    onClick={() => handlePlayTrack(item)}
                                    className={`group flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 cursor-pointer border ${isCurrent
                                        ? 'bg-primary/10 border-primary/20 shadow-xl shadow-primary/5'
                                        : 'bg-transparent border-transparent hover:bg-accent/50 hover:border-accent'
                                        }`}
                                >
                                    {/* Play State / Index */}
                                    <div className="w-10 flex items-center justify-center shrink-0">
                                        {isCurrent && isPlaying ? (
                                            <div className="flex items-end gap-[2px] h-4 mb-0.5">
                                                <div className="w-[3px] bg-primary animate-[music-bar-1_0.8s_ease-in-out_infinite]" />
                                                <div className="w-[3px] bg-primary animate-[music-bar-2_0.8s_ease-in-out_infinite]" />
                                                <div className="w-[3px] bg-primary animate-[music-bar-3_0.8s_ease-in-out_infinite]" />
                                            </div>
                                        ) : (
                                            <span className="text-xs font-black text-muted-foreground/30 group-hover:hidden tracking-tighter">
                                                {(index + 1).toString().padStart(2, '0')}
                                            </span>
                                        )}
                                        <Play className={`h-4 w-4 hidden group-hover:block ${isCurrent ? 'text-primary' : 'text-foreground/80'} fill-current`} />
                                    </div>

                                    {/* Artwork */}
                                    <div className="h-14 w-14 rounded-xl overflow-hidden shadow-md ring-1 ring-border/50 shrink-0 group-hover:scale-105 transition-transform duration-500 bg-muted">
                                        <AsyncImage src={item.picUrl} className="w-full h-full object-cover" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <h4 className={`text-base font-bold truncate tracking-tight transition-colors ${isCurrent ? 'text-primary font-black' : 'text-foreground group-hover:text-primary'}`}>
                                            {item.name}
                                        </h4>
                                        <p className="text-sm font-medium text-muted-foreground/60 truncate tracking-tight">
                                            {item.artists}
                                        </p>
                                    </div>

                                    {/* Meta info (Desktop only) */}
                                    <div className="hidden md:flex flex-col items-end gap-1 px-4 shrink-0">
                                        <span className="text-xs font-bold tabular-nums text-muted-foreground/80">
                                            {item.playCount} 次播放
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 whitespace-nowrap">
                                            {getTimeAgo(item.lastPlayedAt)}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </motion.div>

            <style jsx global>{`
                @keyframes music-bar-1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
                @keyframes music-bar-2 { 0%, 100% { height: 14px; } 50% { height: 6px; } }
                @keyframes music-bar-3 { 0%, 100% { height: 8px; } 50% { height: 16px; } }
            `}</style>
        </ScrollArea>
    )
}
