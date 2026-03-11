"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipForward,
    Maximize2,
    ListMusic
} from "lucide-react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PlayerBar() {
    const {
        currentTrack,
        isPlaying,
        isLoading,
        progress,
        duration,
        setIsFullscreen
    } = usePlayerStore()

    const [localProgress, setLocalProgress] = React.useState(0)
    const isDraggingProgress = React.useRef(false)

    React.useEffect(() => {
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress])

    const handleTogglePlay = () => playerService.togglePlay()
    const handleSkipNext = () => playerService.playNext()

    return (
        <>
            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(calc(-50% - 1rem)); }
                }
                .animate-marquee {
                    animation: marquee 12s linear infinite;
                }
                .hover-pause:hover .animate-marquee {
                    animation-play-state: paused;
                }
                .mask-fade {
                    mask-image: linear-gradient(to right, black calc(100% - 12px), transparent);
                    -webkit-mask-image: linear-gradient(to right, black calc(100% - 12px), transparent);
                }
            `}</style>

            <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 h-16 w-[92vw] sm:w-[420px] bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border border-border/50 shadow-2xl rounded-full flex items-center px-1.5 z-50 transition-transform hover:scale-[1.02]">
                {/* Thin Progress Bar positioned at the bottom curve of the capsule */}
                <div className="absolute bottom-0 left-10 right-10 h-[2px] bg-secondary/50 overflow-hidden rounded-full pointer-events-none">
                    <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${(localProgress / duration) * 100 || 0}%` }}
                    />
                </div>

                {/* Left: Album Cover */}
                <div 
                    className="relative group cursor-pointer overflow-hidden rounded-full w-12 h-12 bg-muted flex-shrink-0 shadow-sm ml-0.5"
                    onClick={() => setIsFullscreen(true)}
                >
                    <div 
                        className="w-full h-full animate-[spin_10s_linear_infinite]"
                        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                    >
                        {currentTrack?.picUrl ? (
                            <img
                                src={currentTrack.picUrl}
                                alt={currentTrack.name}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary">
                                <ListMusic className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                        )}
                    </div>
                    {/* Overlay to hint it's clickable for fullscreen */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 className="h-4 w-4 text-white" />
                    </div>
                </div>

                {/* Middle: Song Info */}
                <div 
                    className="flex-1 flex flex-col justify-center min-w-0 mx-3 cursor-pointer overflow-hidden hover-pause"
                    onClick={() => setIsFullscreen(true)}
                >
                    {/* Song Name with Marquee if long */}
                    <div className="w-full overflow-hidden whitespace-nowrap mask-fade">
                        <div className={cn("inline-flex items-center gap-8", currentTrack?.name && currentTrack.name.length > 15 ? "animate-marquee" : "")}>
                            <span className="font-semibold text-sm text-foreground">
                                {currentTrack?.name || "未在播放"}
                            </span>
                            {currentTrack?.name && currentTrack.name.length > 15 && (
                                <span className="font-semibold text-sm text-foreground">{currentTrack.name}</span>
                            )}
                        </div>
                    </div>
                    {/* Artists with Marquee if long */}
                    <div className="w-full overflow-hidden whitespace-nowrap mask-fade mt-0.5">
                        <div className={cn("inline-flex items-center gap-8", currentTrack?.artists && currentTrack.artists.length > 20 ? "animate-marquee" : "")}>
                            <span className="text-xs text-muted-foreground">
                                {currentTrack?.artists || "享受音乐之旅"}
                            </span>
                            {currentTrack?.artists && currentTrack.artists.length > 20 && (
                                <span className="text-xs text-muted-foreground">{currentTrack.artists}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-0.5 flex-shrink-0 mr-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-foreground rounded-full hover:bg-muted/80"
                        onClick={handleTogglePlay}
                        disabled={!currentTrack || isLoading}
                    >
                        {isPlaying ? (
                            <Pause className="h-5 w-5 fill-current" />
                        ) : (
                            <Play className="h-5 w-5 fill-current ml-0.5" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-foreground rounded-full hover:bg-muted/80"
                        onClick={handleSkipNext}
                        disabled={!currentTrack || isLoading}
                    >
                        <SkipForward className="h-5 w-5 fill-current" />
                    </Button>
                </div>
            </div>
        </>
    )
}
