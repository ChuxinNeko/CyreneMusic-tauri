"use client"

import { useState, useEffect, useCallback } from "react"
import { discoveryService, DiscoveryPlaylist } from "@/lib/services/discoveryService"
import { DiscoveryCard } from "./DiscoveryCard"
import { Loader2, Music2 } from "lucide-react"

interface DiscoverGridProps {
    category: string
    onPlaylistClick: (id: number) => void
}

export function DiscoverGrid({ category, onPlaylistClick }: DiscoverGridProps) {
    const [playlists, setPlaylists] = useState<DiscoveryPlaylist[]>([])
    const [loading, setLoading] = useState(true)

    const fetchPlaylists = useCallback(async () => {
        setLoading(true)
        const result = await discoveryService.getDiscoverPlaylists(category)
        setPlaylists(result)
        setLoading(false)
    }, [category])

    useEffect(() => {
        fetchPlaylists()
    }, [fetchPlaylists])

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {playlists.map((playlist) => (
                <DiscoveryCard
                    key={playlist.id}
                    playlist={playlist}
                    onClick={onPlaylistClick}
                />
            ))}
        </div>
    )
}
