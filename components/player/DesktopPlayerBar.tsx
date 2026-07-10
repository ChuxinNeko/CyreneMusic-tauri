"use client"

import React, { useRef, useState, useEffect } from "react"
import {
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Repeat, Repeat1, Shuffle, Heart, ListMusic
} from "lucide-react"
import { usePlayerStore, RepeatMode } from "@/lib/store/usePlayerStore"
import { Slider } from "@/components/ui/slider"
import { emit } from "@tauri-apps/api/event"
import { cn } from "@/lib/utils"

export function DesktopPlayerBar() {
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const progress = usePlayerStore(s => s.progress)
    const currentTime = usePlayerStore(s => s.currentTime)
    const duration = usePlayerStore(s => s.duration)
    const volume = usePlayerStore(s => s.volume)
    const repeatMode = usePlayerStore(s => s.repeatMode)
    const setRepeatMode = usePlayerStore(s => s.setRepeatMode)

    const [localProgress, setLocalProgress] = useState(progress || 0)
    const isDraggingProgress = useRef(false)
    const [localVolume, setLocalVolume] = useState(volume || 0)
    const isDraggingVolume = useRef(false)

    useEffect(() => {
        if (!currentTrack) {
            setLocalProgress(0)
            return
        }
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress, currentTrack])

    useEffect(() => {
        if (!isDraggingVolume.current) {
            setLocalVolume(volume || 0)
        }
    }, [volume])

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return "00:00"
        const mins = Math.floor(time / 60)
        const secs = Math.floor(time % 60)
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const handleTogglePlay = () => emit("player:command", { type: "toggle-play" })
    const handlePrev = () => emit("player:command", { type: "prev" })
    const handleNext = () => emit("player:command", { type: "next" })
    
    const handleSeekChange = (val: number[]) => {
        isDraggingProgress.current = true
        setLocalProgress(val[0])
    }
    const handleSeekCommit = (val: number[]) => {
        if (currentTrack && duration > 0) {
            emit("player:seek", val[0] * duration)
        }
        isDraggingProgress.current = false
    }
    
    const handleVolumeChange = (val: number[]) => {
        isDraggingVolume.current = true
        setLocalVolume(val[0])
        emit("player:command", { type: "set-volume", volume: val[0] })
    }
    const handleVolumeCommit = (val: number[]) => {
        isDraggingVolume.current = false
        emit("player:command", { type: "set-volume", volume: val[0] })
    }

    const toggleRepeatMode = () => {
        const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
        const currentIndex = modes.indexOf(repeatMode)
        setRepeatMode(modes[(currentIndex + 1) % modes.length])
    }

    return (
        <div className="w-full h-[88px] rounded-[8px] flex items-center px-6 gap-6 relative overflow-hidden group
            border border-white/20
            bg-transparent
            shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.16)]">
            {/* 顶部高光线 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
            
            {/* Left: Track Info */}
            <div className="flex items-center gap-4 w-[30%] min-w-[200px] z-10">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-white/10 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-shadow">
                    {currentTrack?.picUrl ? (
                        <img src={currentTrack.picUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <ListMusic className="text-white/30 w-6 h-6" />
                        </div>
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-white font-bold text-[15px] truncate drop-shadow-md">{currentTrack?.name || "Cyrene Music"}</span>
                    <span className="text-white/60 text-[13px] truncate mt-0.5 drop-shadow-sm">{currentTrack?.artists || "Enjoy the music"}</span>
                </div>
            </div>

            {/* Center: Controls & Progress */}
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 max-w-2xl z-10">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={toggleRepeatMode}
                        className={cn("transition-colors hover:text-white", repeatMode === RepeatMode.All ? "text-white/50" : "text-white")}
                    >
                        {repeatMode === RepeatMode.One ? <Repeat1 size={18} /> : repeatMode === RepeatMode.Shuffle ? <Shuffle size={18} /> : <Repeat size={18} />}
                    </button>
                    <button onClick={handlePrev} className="text-white/80 hover:text-white transition-transform active:scale-90">
                        <SkipBack size={22} className="fill-current" />
                    </button>
                    <button onClick={handleTogglePlay} className="w-12 h-12 bg-white/10 hover:bg-white text-white hover:text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-white/20 hover:border-white shadow-xl">
                        {isPlaying ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current ml-1" />}
                    </button>
                    <button onClick={handleNext} className="text-white/80 hover:text-white transition-transform active:scale-90">
                        <SkipForward size={22} className="fill-current" />
                    </button>
                    <button className="text-white/50 hover:text-white transition-colors">
                        <Heart size={18} />
                    </button>
                </div>
                <div className="w-full flex items-center gap-3 px-4">
                    <span className="text-[11px] text-white/50 font-medium w-10 text-right tabular-nums">{formatTime(isDraggingProgress.current ? localProgress * duration : currentTime)}</span>
                    <div className="flex-1 h-3 flex items-center">
                        <Slider
                            value={[localProgress]}
                            max={1}
                            step={0.001}
                            onValueChange={handleSeekChange}
                            onValueCommit={handleSeekCommit}
                            className="w-full"
                            variant="apple" 
                        />
                    </div>
                    <span className="text-[11px] text-white/50 font-medium w-10 tabular-nums">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Right: Volume */}
            <div className="w-[30%] min-w-[150px] flex items-center justify-end gap-3 z-10">
                <button 
                    onClick={() => {
                        const newVol = localVolume > 0 ? 0 : 0.8;
                        setLocalVolume(newVol);
                        emit("player:command", { type: "set-volume", volume: newVol });
                    }} 
                    className="text-white/70 hover:text-white transition-colors"
                >
                    {localVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div className="w-24 flex items-center h-3">
                    <Slider
                        value={[localVolume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        onValueCommit={handleVolumeCommit}
                        className="w-full"
                        variant="apple"
                    />
                </div>
            </div>
        </div>
    )
}
