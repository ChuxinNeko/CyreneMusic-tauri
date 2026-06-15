"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    User,
    Loader2,
    Footprints,
    ChevronLeft
} from "lucide-react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist } from "@/lib/models/playlist"
import { PlaylistDetailView } from "@/components/discovery/PlaylistDetailView"
import { ProfileHeader } from "@/components/profile/ProfileHeader"
import { PlaylistSection } from "@/components/profile/PlaylistSection"

export default function ProfilePage() {
    const { user, isLoggedIn, token } = useAuthStore()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const selectedPlaylistId = searchParams.get("playlist")

    const setSelectedPlaylistId = (id: string | number | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (id) {
            params.set("playlist", id.toString())
        } else {
            params.delete("playlist")
        }
        router.push(`/profile?${params.toString()}`)
    }

    const fetchData = async (silent = false) => {
        if (!isLoggedIn) return
        if (!silent) setLoading(true)
        try {
            const playlistsData = await playlistService.getPlaylists()
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

    const renderBody = () => {
        if (!isLoggedIn) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="relative">
                        <div className="p-10 rounded-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent border border-primary/10 shadow-inner">
                            <User className="w-16 h-16 text-primary/40" />
                        </div>
                    </div>
                    <div className="text-center space-y-3 max-w-sm">
                        <h2 className="text-3xl font-black tracking-tighter">发现你的音乐世界</h2>
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
                <div className="flex min-h-[60vh] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            )
        }

        if (selectedPlaylistId) {
            return (
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
            )
        }

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="px-6 lg:px-10 pb-32 space-y-10 max-w-7xl mx-auto"
            >
                <ProfileHeader user={user} />

                <div
                    className="flex items-center gap-4 p-5 rounded-3xl bg-card/30 hover:bg-card/50 backdrop-blur-md border border-border/40 transition-all group ring-1 ring-white/5 cursor-pointer"
                    onClick={() => router.push("/footprint")}
                >
                    <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Footprints className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold tracking-tight">听歌足迹</h3>
                        <p className="text-sm text-muted-foreground">查看聆听时长和播放排行</p>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors rotate-180" />
                </div>

                <div className="space-y-12">
                    <PlaylistSection
                        playlists={playlists}
                        onPlaylistClick={setSelectedPlaylistId}
                        onRefresh={() => fetchData(true)}
                        onRemoveLocally={removePlaylistLocally}
                    />
                </div>
            </motion.div>
        )
    }

    return (
        <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:!block">
            <div className={selectedPlaylistId ? "lg:mt-8 sm:px-6 lg:px-10" : "mt-6 lg:mt-8"}>
                {renderBody()}
            </div>
        </ScrollArea>
    )
}