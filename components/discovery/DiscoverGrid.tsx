"use client"

import { useState, useEffect, useCallback } from "react"
import { discoveryService, DiscoveryPlaylist } from "@/lib/services/discoveryService"
import { DiscoveryCard } from "./DiscoveryCard"
import { Loader2, Music2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DiscoverGridProps {
    category: string
    onPlaylistClick: (id: number) => void
}

export function DiscoverGrid({ category, onPlaylistClick }: DiscoverGridProps) {
    const [playlists, setPlaylists] = useState<DiscoveryPlaylist[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchPlaylists = useCallback(async (forceRefresh = false) => {
        if (forceRefresh) setIsRefreshing(true)
        else setLoading(true)
        
        const result = await discoveryService.getDiscoverPlaylists(category, forceRefresh)
        setPlaylists(result)
        
        setLoading(false)
        setIsRefreshing(false)
    }, [category])

    useEffect(() => {
        fetchPlaylists()
    }, [fetchPlaylists])

    const handleRefresh = () => {
        fetchPlaylists(true)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">正在获取精彩歌单...</p>
            </div>
        )
    }

    if (playlists.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Music2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">暂无发现内容</h3>
                <p className="text-sm text-muted-foreground">该分类下暂时没有推荐歌单，换个分类看看吧。</p>
            </div>
        )
    }

    return (
        <div className="space-y-2 sm:space-y-4">
            <div className="flex justify-end pr-2 -mt-2 sm:-mt-12 relative z-20">
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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4 lg:gap-6 py-2 sm:py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {playlists.map((playlist) => (
                    <DiscoveryCard
                        key={playlist.id}
                        playlist={playlist}
                        onClick={onPlaylistClick}
                    />
                ))}
            </div>
        </div>
    )
}
