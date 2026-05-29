"use client"

import React, { useState, useMemo } from "react"
import {
    Search,
    Trash2,
    Music2,
    Play,
    X,
    ListMusic
} from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { AsyncImage } from "@/components/common/AsyncImage"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export function PlaylistPanel() {
    const { queue, currentTrack, isPlaying, setQueue } = usePlayerStore()
    const [searchQuery, setSearchQuery] = useState("")
    const isMobile = useIsMobile()

    const filteredQueue = useMemo(() => {
        if (!searchQuery.trim()) return queue
        const query = searchQuery.toLowerCase()
        return queue.filter(track =>
            track.name.toLowerCase().includes(query) ||
            track.artists.toLowerCase().includes(query)
        )
    }, [queue, searchQuery])

    const handleClearQueue = () => {
        setQueue([])
        // Optional: stop playback if clearing? 
        // For now just clear queue as per usual music player behavior
    }

    const handleRemoveTrack = (e: React.MouseEvent, trackId: string | number) => {
        e.stopPropagation()
        const newQueue = queue.filter(t => t.id !== trackId)
        setQueue(newQueue)
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "text-muted-foreground hover:text-foreground relative group",
                        isMobile ? "h-10 w-10 rounded-full hover:bg-muted/80" : "h-8 w-8"
                    )}
                >
                    <ListMusic className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                    {queue.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-sm">
                            {queue.length > 99 ? '99+' : queue.length}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent 
                side={isMobile ? "bottom" : "right"} 
                className={cn(
                    "p-0 flex flex-col gap-0 bg-background/95 backdrop-blur-md overflow-hidden",
                    isMobile 
                        ? "w-full h-full max-h-[80vh] rounded-t-2xl border-t" 
                        : "w-full sm:max-w-md border-l"
                )}
            >
                <SheetHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between mb-4">
                        <SheetTitle className="text-xl font-black flex items-center gap-2">
                            <ListMusic className="h-5 w-5 text-primary" />
                            播放队列
                        </SheetTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive gap-2 font-bold h-8 px-2"
                            onClick={handleClearQueue}
                            disabled={queue.length === 0}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            清空
                        </Button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="搜索队列中的歌曲..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-accent/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-10 rounded-xl"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4">
                    <div className="py-4 space-y-1">
                        {filteredQueue.length > 0 ? (
                            filteredQueue.map((track, index) => {
                                const isCurrent = currentTrack?.id === track.id && currentTrack?.source === track.source
                                return (
                                    <div
                                        key={`${track.id}-${track.source}-${index}`}
                                        onClick={() => playerService.playTrack(track)}
                                        className={cn(
                                            "group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all duration-300 border border-transparent",
                                            isCurrent
                                                ? "bg-primary/10 border-primary/20 shadow-sm"
                                                : "hover:bg-accent/50 hover:border-accent"
                                        )}
                                    >
                                        <div className="relative h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden shadow-sm">
                                            <AsyncImage src={track.picUrl} alt={track.name} className="h-full w-full" />
                                            {isCurrent && isPlaying ? (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <div className="flex items-end gap-[1.5px] h-3">
                                                        <div className="w-0.5 bg-primary animate-[music-bar-1_0.8s_ease-in-out_infinite]" />
                                                        <div className="w-0.5 bg-primary animate-[music-bar-2_0.8s_ease-in-out_infinite]" />
                                                        <div className="w-0.5 bg-primary animate-[music-bar-3_0.8s_ease-in-out_infinite]" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Play className="h-4 w-4 text-white fill-white" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 pr-2">
                                            <h4 className={cn(
                                                "text-sm font-bold truncate tracking-tight transition-colors",
                                                isCurrent ? "text-primary" : "text-foreground group-hover:text-primary"
                                            )}>
                                                {track.name}
                                            </h4>
                                            <p className="text-[11px] font-medium text-muted-foreground/60 truncate">
                                                {track.artists}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => handleRemoveTrack(e, track.id)}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                                <div className="p-4 bg-muted rounded-full">
                                    <Music2 className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">队列空空如也</p>
                                    <p className="text-xs">去发现更多好听的音乐吧</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-accent/10 border-t">
                    <p className="text-[10px] text-muted-foreground text-center font-bold uppercase tracking-widest opacity-50">
                        {filteredQueue.length} 首歌曲 · 已在此设备同步
                    </p>
                </div>
            </SheetContent>

            <style jsx global>{`
                @keyframes music-bar-1 { 0%, 100% { height: 4px; } 50% { height: 12px; } }
                @keyframes music-bar-2 { 0%, 100% { height: 12px; } 50% { height: 6px; } }
                @keyframes music-bar-3 { 0%, 100% { height: 7px; } 50% { height: 14px; } }
            `}</style>
        </Sheet>
    )
}
