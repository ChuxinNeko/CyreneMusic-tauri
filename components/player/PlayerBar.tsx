"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    ListMusic,
    Maximize2,
    Repeat,
    Repeat1,
    Shuffle
} from "lucide-react"
import { usePlayerStore, RepeatMode } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
        setVolume,
        setRepeatMode,
        setIsFullscreen
    } = usePlayerStore()

    const [localProgress, setLocalProgress] = React.useState(0)
    const [localVolume, setLocalVolume] = React.useState(0)
    const isDraggingProgress = React.useRef(false)
    const isDraggingVolume = React.useRef(false)

    React.useEffect(() => {
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress])

    React.useEffect(() => {
        if (!isDraggingVolume.current) {
            setLocalVolume(volume || 0)
        }
    }, [volume])

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "00:00"
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
        <div className="h-20 border-t bg-background/60 backdrop-blur-xl px-4 flex items-center justify-between z-50">
            {/* Left: Track Info */}
            <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
                <div
                    className="relative group cursor-pointer overflow-hidden rounded-md w-12 h-12 bg-muted flex-shrink-0 border"
                    onClick={() => setIsFullscreen(true)}
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
                </div>
                <div className="flex flex-col min-w-0">
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
                    <span className="text-xs text-muted-foreground truncate italic">
                        {currentTrack?.artists || "享受音乐之旅"}
                    </span>
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
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                        <ListMusic className="h-4 w-4" />
                    </Button>
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
                    onClick={() => setIsFullscreen(true)}
                >
                    <Maximize2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
