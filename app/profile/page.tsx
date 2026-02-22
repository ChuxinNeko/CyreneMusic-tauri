"use client"

import { useState, useEffect } from "react"
import {
    User,
    Music2,
    Library,
    Loader2
} from "lucide-react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { listeningStatsService } from "@/lib/services/listeningStatsService"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist } from "@/lib/models/playlist"
import { PlaylistDetailView } from "@/components/discovery/PlaylistDetailView"
import { ProfileHeader } from "@/components/profile/ProfileHeader"
import { ProfileStats } from "@/components/profile/ProfileStats"
import { PlaylistSection } from "@/components/profile/PlaylistSection"
import { TopRankingSection } from "@/components/profile/TopRankingSection"

export default function ProfilePage() {
    const { user, isLoggedIn, token } = useAuthStore()
    const [stats, setStats] = useState<any>(null)
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | number | null>(null)

    const fetchData = async (silent = false) => {
        if (!isLoggedIn) return
        if (!silent) setLoading(true)
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
        if (!silent) setLoading(false)
    }

    const removePlaylistLocally = (id: string | number) => {
        setPlaylists(prev => prev.filter(p => String(p.id) !== String(id)))
    }

    useEffect(() => {
        fetchData()
    }, [isLoggedIn])

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
                        fetchData(true)
                    }}
                    onRemoveLocally={removePlaylistLocally}
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
                    <ProfileHeader user={user} />

                    <ProfileStats stats={stats} />

                    <div className="space-y-12">
                        <PlaylistSection
                            playlists={playlists}
                            onPlaylistClick={setSelectedPlaylistId}
                            onRefresh={() => fetchData(true)}
                            onRemoveLocally={removePlaylistLocally}
                        />

                        <TopRankingSection topPlays={topPlays} />
                    </div>
                </motion.div>
            </div>
        </ScrollArea>
    )
}
