"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    ChevronDown
} from "lucide-react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { LyricPlayer } from "./LyricPlayer"
import { Slider } from "@/components/ui/slider"

export function FullscreenPlayer() {
    const {
        currentTrack,
        isPlaying,
        progress,
        currentTime,
        duration,
        volume,
        isFullscreen,
        setIsFullscreen,
    } = usePlayerStore()

    if (!isFullscreen) return null

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00"
        const mins = Math.floor(Math.abs(seconds) / 60)
        const secs = Math.floor(Math.abs(seconds) % 60)
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const handleTogglePlay = () => playerService.togglePlay()
    const handleSkipNext = () => playerService.playNext()
    const handleSkipPrevious = () => playerService.playPrevious()
    const handleSeek = (value: number[]) => {
        const time = value[0] * duration
        playerService.seek(time)
    }

    const handleVolumeChange = (value: number[]) => {
        playerService.setVolume(value[0])
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col animate-in fade-in duration-500">
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0">
                {currentTrack?.picUrl && (
                    <img
                        src={currentTrack.picUrl}
                        alt="Background"
                        className="w-[124%] h-[124%] object-cover absolute -top-[12%] -left-[12%] blur-[100px] saturate-[1.6] brightness-[0.5] transition-opacity duration-1000"
                    />
                )}
                <div className="absolute inset-0 bg-black/30" />
            </div>

            {/* Top Bar / Close Button */}
            <div className="relative z-[110] flex justify-between items-center p-6 lg:p-8">
                <button
                    onClick={() => setIsFullscreen(false)}
                    className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full"
                >
                    <ChevronDown size={28} />
                </button>
            </div>

            {/* Main Content Layout (45/55) */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[45%_55%] h-full w-full max-w-[1700px] mx-auto overflow-hidden pb-8 lg:pb-12">

                {/* Left Panel: Info & Controls */}
                <div className="flex flex-col justify-center px-[6vw] space-y-6 lg:space-y-8 min-h-0 overflow-hidden">
                    {/* Album Art Container with responsive size */}
                    <div className="relative aspect-square w-full max-w-[320px] 2xl:max-w-[400px] self-center group flex-shrink-1">
                        <div className="absolute inset-0 bg-black/40 blur-3xl scale-95 translate-y-8 opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                        <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.02] bg-white/5 border border-white/10">
                            {currentTrack?.picUrl ? (
                                <img src={currentTrack.picUrl} alt={currentTrack.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">CYRENE</div>
                            )}
                        </div>
                    </div>

                    {/* Track Info */}
                    <div className="w-full max-w-[400px] self-center space-y-1">
                        <h1 className="text-[1.8rem] lg:text-[2.2rem] 2xl:text-[2.6rem] font-bold text-white leading-tight tracking-tight truncate">
                            {currentTrack?.name || "未在播放"}
                        </h1>
                        <p className="text-[1.1rem] lg:text-[1.2rem] 2xl:text-[1.3rem] text-white/50 font-medium truncate">
                            {currentTrack?.artists || "未知歌手"}
                        </p>
                    </div>

                    {/* Controls & Progress */}
                    <div className="w-full max-w-[400px] self-center space-y-6 lg:space-y-8">
                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <Slider
                                value={[progress || 0]}
                                max={1}
                                step={0.0001}
                                onValueChange={handleSeek}
                                className="w-full h-1.5"
                            />
                            <div className="flex justify-between text-[0.75rem] text-white/40 font-semibold tabular-nums tracking-wider uppercase">
                                <span>{formatTime(currentTime)}</span>
                                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                            </div>
                        </div>

                        {/* Playback Buttons */}
                        <div className="flex items-center justify-between px-2 lg:px-4">
                            <button onClick={handleSkipPrevious} className="text-white/70 hover:text-white transition-all active:scale-90 p-2">
                                <SkipBack size={28} fill="currentColor" />
                            </button>
                            <button
                                onClick={handleTogglePlay}
                                className="text-black bg-white hover:scale-105 active:scale-95 transition-all rounded-full p-4 lg:p-5 shadow-xl"
                            >
                                {isPlaying ? (
                                    <Pause size={40} fill="currentColor" />
                                ) : (
                                    <Play size={40} fill="currentColor" className="ml-1" />
                                )}
                            </button>
                            <button onClick={handleSkipNext} className="text-white/70 hover:text-white transition-all active:scale-90 p-2">
                                <SkipForward size={28} fill="currentColor" />
                            </button>
                        </div>

                        {/* Volume Slider */}
                        <div className="flex items-center gap-4 text-white/30 px-2 group">
                            <Volume2 size={16} className="group-hover:text-white/60 transition-colors" />
                            <Slider
                                value={[volume]}
                                max={1}
                                step={0.01}
                                onValueChange={handleVolumeChange}
                                className="flex-1 h-1"
                            />
                        </div>
                    </div>

                    {/* Quality Badges */}
                    <div className="flex gap-3 w-full max-w-[400px] self-center opacity-30">
                        <span className="text-[0.6rem] border border-white/40 text-white px-1.5 py-0.5 rounded-[4px] font-bold tracking-widest uppercase">Lossless</span>
                        <span className="text-[0.6rem] border border-white/40 text-white px-1.5 py-0.5 rounded-[4px] font-bold tracking-widest uppercase">Master</span>
                    </div>
                </div>

                {/* Right Panel: High-Fidelity Lyric Player */}
                <div className="relative h-full overflow-hidden">
                    <LyricPlayer />
                </div>
            </div>
        </div>
    )
}
