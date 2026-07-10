"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Maximize2,
    Repeat,
    Repeat1,
    Shuffle,
    ListMusic,
    AlertCircle
} from "lucide-react"
import { usePlayerStore, RepeatMode } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PlaylistPanel } from "./PlaylistPanel"

export function PlayerBar() {
    const {
        currentTrack,
        isPlaying,
        isLoading,
        progress,
        currentTime,
        duration,
        volume,
        repeatMode,
        playError,
        setVolume,
        setRepeatMode,
    } = usePlayerStore()
    const setIsFullscreen = usePlayerStore(s => s.setIsFullscreen)

    const openFullscreen = () => setIsFullscreen(true)

    const [localProgress, setLocalProgress] = React.useState(0)
    const [localVolume, setLocalVolume] = React.useState(0)
    const isDraggingProgress = React.useRef(false)
    const isDraggingVolume = React.useRef(false)

    React.useEffect(() => {
        if (!currentTrack) {
            setLocalProgress(0)
            return
        }
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress, currentTrack])

    React.useEffect(() => {
        if (!isDraggingVolume.current) {
            setLocalVolume(volume || 0)
        }
    }, [volume])

    const formatTime = (seconds: number) => {
        if (!seconds || !isFinite(seconds)) return "00:00"
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    const handleTogglePlay = () => playerService.togglePlay()
    const handleSkipNext = () => playerService.playNext()
    const handleSkipPrevious = () => playerService.playPrevious()
    
    const handleSeekChange = (value: number[]) => {
        isDraggingProgress.current = true
        setLocalProgress(value[0])
    }

    const handleSeekCommit = (value: number[]) => {
        playerService.seek(value[0] * duration)
        setTimeout(() => {
            isDraggingProgress.current = false
        }, 200)
    }

    const handleVolumeChange = (value: number[]) => {
        isDraggingVolume.current = true
        setLocalVolume(value[0])
        playerService.setVolume(value[0])
    }

    const handleVolumeCommit = (value: number[]) => {
        playerService.setVolume(value[0])
        setTimeout(() => {
            isDraggingVolume.current = false
        }, 200)
    }

    const toggleRepeatMode = () => {
        const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
        const currentIndex = modes.indexOf(repeatMode)
        const nextMode = modes[(currentIndex + 1) % modes.length]
        setRepeatMode(nextMode)
    }

    const getRepeatIcon = () => {
        switch (repeatMode) {
            case RepeatMode.One: return <Repeat1 className="h-4 w-4" />
            case RepeatMode.Shuffle: return <Shuffle className="h-4 w-4" />
            default: return <Repeat className="h-4 w-4" />
        }
    }

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
            
            {/* === 桌面端视图 === */}
            <div className="hidden md:flex h-20 border-t bg-transparent px-4 items-center justify-between z-50">
                {/* Left: Track Info */}
                <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
                    <div
                        className="relative group cursor-pointer overflow-hidden rounded-md w-12 h-12 bg-muted flex-shrink-0 border"
                        onClick={openFullscreen}
                    >
                        {currentTrack?.picUrl ? (
                            <img
                                src={currentTrack.picUrl}
                                alt={currentTrack.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ListMusic className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="h-4 w-4 text-white" />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className="font-medium text-sm truncate">
                                {currentTrack?.name || "未在播放"}
                            </span>
                            {currentTrack?.source && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0 uppercase opacity-70">
                                    {currentTrack.source}
                                </Badge>
                            )}
                        </div>
                        {playError ? (
                            <span className="text-xs text-destructive font-medium flex items-center gap-1 cursor-help truncate mt-0.5" title={playError}>
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                播放失败: {playError}
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground truncate italic">
                                {currentTrack?.artists || "享受音乐之旅"}
                            </span>
                        )}
                    </div>
                </div>

                {/* Middle: Controls & Progress */}
                <div className="flex flex-col items-center max-w-2xl w-full px-8">
                    <div className="flex items-center gap-5 mb-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={toggleRepeatMode}
                            title={`循环模式: ${repeatMode}`}
                        >
                            {getRepeatIcon()}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={handleSkipPrevious}
                        >
                            <SkipBack className="h-5 w-5 fill-current" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-full shadow-md hover:scale-105 transition-transform"
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
                            className="h-9 w-9"
                            onClick={handleSkipNext}
                        >
                            <SkipForward className="h-5 w-5 fill-current" />
                        </Button>
                        <PlaylistPanel />
                    </div>

                    <div className="w-full flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
                            {formatTime(currentTime)}
                        </span>
                        <Slider
                            value={[localProgress]}
                            max={1}
                            step={0.001}
                            onValueChange={handleSeekChange}
                            onValueCommit={handleSeekCommit}
                            className="flex-1"
                            disabled={!currentTrack}
                            highlightRanges={duration > 0 ? currentTrack?.chorus?.map(c => ({
                                start: (c.startTime / 1000) / duration,
                                end: (c.endTime / 1000) / duration
                            })) : undefined}
                        />
                        <span className="text-[10px] text-muted-foreground font-mono w-10">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* Right: Volume & Extra */}
                <div className="flex items-center justify-end gap-4 w-1/4">
                    <div className="flex items-center gap-2 w-32 group">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground group-hover:text-foreground"
                            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                        >
                            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <Slider
                            value={[localVolume]}
                            max={1}
                            step={0.01}
                            onValueChange={handleVolumeChange}
                            onValueCommit={handleVolumeCommit}
                            className="w-full"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={openFullscreen}
                    >
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* === 移动端视图 (保留胶囊样式) === */}
            <div className="flex md:hidden fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 h-16 w-[92vw] sm:w-[420px] bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border border-border/50 shadow-2xl rounded-full items-center px-1.5 z-50 transition-transform hover:scale-[1.02]">
                {/* Thin Progress Bar positioned at the bottom curve of the capsule */}
                <div className="absolute bottom-0 left-10 right-10 h-[2px] bg-secondary/50 overflow-hidden rounded-full pointer-events-none">
                    <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${localProgress * 100}%` }}
                    />
                </div>

                {/* Left: Album Cover */}
                <div 
                    className="relative group cursor-pointer overflow-hidden rounded-full w-12 h-12 bg-muted flex-shrink-0 shadow-sm ml-0.5"
                    onClick={openFullscreen}
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
                    onClick={openFullscreen}
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
                        {playError ? (
                            <span className="text-xs text-destructive font-medium flex items-center gap-1 truncate" title={playError}>
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                播放失败: {playError}
                            </span>
                        ) : (
                            <div className={cn("inline-flex items-center gap-8", currentTrack?.artists && currentTrack.artists.length > 20 ? "animate-marquee" : "")}>
                                <span className="text-xs text-muted-foreground">
                                    {currentTrack?.artists || "享受音乐之旅"}
                                </span>
                                {currentTrack?.artists && currentTrack.artists.length > 20 && (
                                    <span className="text-xs text-muted-foreground">{currentTrack.artists}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-0.5 flex-shrink-0 mr-1">
                    <PlaylistPanel />
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

