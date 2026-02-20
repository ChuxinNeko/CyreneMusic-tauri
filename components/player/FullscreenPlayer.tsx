"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    ChevronDown,
    Languages,
    Minus,
    Square,
    X
} from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
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
        showTranslation,
        toggleTranslation,
    } = usePlayerStore()

    const [localProgress, setLocalProgress] = React.useState(0)
    const [localVolume, setLocalVolume] = React.useState(0)
    const isDraggingProgress = React.useRef(false)
    const isDraggingVolume = React.useRef(false)
    const [isVisible, setIsVisible] = React.useState(isFullscreen)
    const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)
    const [isMaximized, setIsMaximized] = React.useState(false)

    React.useEffect(() => {
        const updateMaximizedState = async () => {
            const appWindow = getCurrentWindow()
            setIsMaximized(await appWindow.isMaximized())
        }
        updateMaximizedState()
    }, [])

    const minimize = async () => {
        const appWindow = getCurrentWindow()
        await appWindow.minimize()
    }

    const toggleMaximize = async () => {
        const appWindow = getCurrentWindow()
        await appWindow.toggleMaximize()
        setIsMaximized(!isMaximized)
    }

    const closeWindow = async () => {
        const appWindow = getCurrentWindow()
        await appWindow.close()
    }

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

    React.useEffect(() => {
        if (isFullscreen) {
            setIsVisible(true)
            setIsAnimatingOut(false)
        } else if (isVisible) {
            setIsAnimatingOut(true)
            const timer = setTimeout(() => {
                setIsVisible(false)
                setIsAnimatingOut(false)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [isFullscreen, isVisible])

    if (!isVisible) return null

    const hasTranslation = !!(currentTrack?.tlyric || currentTrack?.ytlrc)

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00"
        const mins = Math.floor(Math.abs(seconds) / 60)
        const secs = Math.floor(Math.abs(seconds) % 60)
        return `${mins}:${secs.toString().padStart(2, "0")}`
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

    return (
        <div className={`fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col ${isAnimatingOut ? 'animate-out fade-out slide-out-to-top-4 duration-500' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>
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
            <div data-tauri-drag-region className="relative z-[110] flex justify-between items-center px-6 py-4 lg:px-8 lg:py-4">
                <button
                    onClick={() => setIsFullscreen(false)}
                    className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10"
                >
                    <ChevronDown size={28} />
                </button>
                <div data-tauri-drag-region className="flex-1 h-full mx-4" />
                <div className="flex items-center gap-2 z-10">
                    {hasTranslation && (
                        <button
                            onClick={toggleTranslation}
                            className={`p-2 rounded-full transition-colors ${showTranslation ? 'text-white bg-white/15 hover:bg-white/20' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
                            title={showTranslation ? '隐藏翻译' : '显示翻译'}
                        >
                            <Languages size={20} />
                        </button>
                    )}
                    <div className="flex items-center gap-2 ml-4 text-white/50">
                        <button
                            onClick={minimize}
                            className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <Minus size={20} />
                        </button>
                        <button
                            onClick={toggleMaximize}
                            className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <Square size={20} />
                        </button>
                        <button
                            onClick={closeWindow}
                            className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors hover:bg-destructive hover:text-destructive-foreground"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Layout (45/55) */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[45%_55%] flex-1 min-h-0 w-full max-w-[1700px] mx-auto overflow-hidden pb-6 lg:pb-8">

                {/* Left Panel: Info & Controls */}
                <div className="flex flex-col items-center justify-center px-[4vw] lg:px-[6vw] h-full min-h-0 overflow-hidden">

                    {/* Flexible spacer above */}
                    <div className="flex-[0.5] min-h-[1vh]" />

                    {/* Album Art Container with responsive size */}
                    <div className="relative aspect-square w-full max-w-[min(100%,40vh)] lg:max-w-[min(100%,45vh)] 2xl:max-w-[min(100%,50vh)] shrink">
                        <div className="absolute inset-0 bg-black/40 blur-3xl scale-95 translate-y-8 opacity-60 hover:opacity-80 transition-opacity duration-500" />
                        <div className="relative w-full h-full rounded-[20px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-transform duration-500 hover:scale-[1.02] bg-white/5 border border-white/10">
                            {currentTrack?.picUrl ? (
                                <img src={currentTrack.picUrl} alt={currentTrack.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">CYRENE</div>
                            )}
                        </div>
                    </div>

                    {/* Spacing between art and info */}
                    <div className="h-[3vh] min-h-[16px] shrink-0" />

                    {/* Track Info */}
                    <div className="w-full max-w-[400px] shrink-0 flex flex-col items-center text-center space-y-1 lg:space-y-2">
                        <h1 className="text-[clamp(1.5rem,4vh,2.6rem)] font-bold text-white leading-tight tracking-[-0.5px] truncate w-full">
                            {currentTrack?.name || "未在播放"}
                        </h1>
                        <p className="text-[clamp(1rem,2vh,1.3rem)] text-white/50 font-medium truncate w-full">
                            {currentTrack?.artists || "未知歌手"}
                        </p>
                    </div>

                    {/* Spacing between info and controls */}
                    <div className="h-[3vh] min-h-[16px] shrink-0" />

                    {/* Controls & Progress */}
                    <div className="w-full max-w-[400px] shrink-0 space-y-4 lg:space-y-6">
                        {/* Progress Bar */}
                        <div className="space-y-2 lg:space-y-3 group/progress">
                            <div className="h-3 flex items-center">
                                <Slider
                                    value={[localProgress]}
                                    max={1}
                                    step={0.0001}
                                    onValueChange={handleSeekChange}
                                    onValueCommit={handleSeekCommit}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex justify-between text-[0.75rem] text-white/50 font-semibold tabular-nums tracking-wider px-1">
                                <span>{formatTime(isDraggingProgress.current ? localProgress * duration : currentTime)}</span>
                                <span>-{formatTime(Math.max(0, duration - (isDraggingProgress.current ? localProgress * duration : currentTime)))}</span>
                            </div>
                        </div>

                        {/* Playback Buttons */}
                        <div className="flex items-center justify-center gap-8 lg:gap-12 mt-1 lg:mt-2">
                            <button onClick={handleSkipPrevious} className="text-white/90 hover:text-white transition-all active:scale-90 p-2">
                                <SkipBack size={36} fill="currentColor" />
                            </button>
                            <button
                                onClick={handleTogglePlay}
                                className="text-white hover:text-white/90 active:scale-95 transition-all p-2"
                            >
                                {isPlaying ? (
                                    <Pause size={56} fill="currentColor" />
                                ) : (
                                    <Play size={56} fill="currentColor" />
                                )}
                            </button>
                            <button onClick={handleSkipNext} className="text-white/90 hover:text-white transition-all active:scale-90 p-2">
                                <SkipForward size={36} fill="currentColor" />
                            </button>
                        </div>

                        {/* Volume Slider */}
                        <div className="flex items-center justify-center gap-4 text-white/50 px-8 lg:px-12 group/volume mt-2 lg:mt-4">
                            <Volume2 size={20} className="group-hover/volume:text-white/80 transition-colors" />
                            <div className="flex-1 h-3 flex items-center">
                                <Slider
                                    value={[localVolume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                    onValueCommit={handleVolumeCommit}
                                    className="w-full opacity-60 group-hover/volume:opacity-100 transition-opacity"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quality Badges */}
                    <div className="flex justify-center gap-3 w-full shrink-0 opacity-30 mt-4 lg:mt-6">
                        <span className="text-[0.6rem] border border-white/40 text-white px-1.5 py-0.5 rounded-[4px] font-bold tracking-widest uppercase">Lossless</span>
                        <span className="text-[0.6rem] border border-white/40 text-white px-1.5 py-0.5 rounded-[4px] font-bold tracking-widest uppercase">Master</span>
                    </div>

                    {/* Flexible spacer below */}
                    <div className="flex-1 min-h-[1vh]" />
                </div>

                {/* Right Panel: High-Fidelity Lyric Player */}
                <div className="relative h-full overflow-hidden">
                    <LyricPlayer />
                </div>
            </div>
        </div>
    )
}
