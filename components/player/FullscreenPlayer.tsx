"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume,
    Volume2,
    ChevronDown,
    Languages,
    Minus,
    Square,
    X,
    MoreHorizontal,
    Activity,
    Type,
    Droplets,
    Monitor,
    Baseline,
    Palette
} from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { emit } from "@tauri-apps/api/event"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { audioAnalyser } from "@/lib/services/audioAnalyser"
import { LyricPlayer } from "./LyricPlayer"
import { WebGLBackground } from "./WebGLBackground"
import { Slider } from "@/components/ui/slider"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { invoke } from "@tauri-apps/api/core"

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
        audioVisualization,
        toggleAudioVisualization,
        lyricFontSize,
        setLyricFontSize,
        lyricBlurStrength,
        setLyricBlurStrength,
        desktopLyricFontSize,
        desktopLyricColor,
        desktopLyricStrokeColor,
        setDesktopLyricFontSize,
        setDesktopLyricColor,
        setDesktopLyricStrokeColor,
    } = usePlayerStore()

    const [localProgress, setLocalProgress] = React.useState(0)
    const [localVolume, setLocalVolume] = React.useState(0)
    const isDraggingProgress = React.useRef(false)
    const isDraggingVolume = React.useRef(false)
    const [isVisible, setIsVisible] = React.useState(isFullscreen)
    const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)
    const [isMaximized, setIsMaximized] = React.useState(false)

    // 音频频率数据通过 ref 直接注入 WebGL，避免触发 React 重绘
    const bgRef = React.useRef<any>(null)
    const rafRef = React.useRef<number>(0)

    // 频率数据采集循环
    React.useEffect(() => {
        if (!isVisible || !isPlaying || !audioVisualization) {
            bgRef.current?.bgRender?.setFrequencyData(0, 0, 0)
            return
        }

        const updateFreq = () => {
            const data = audioAnalyser.getFrequencyData()
            // 直接操作渲染器内部状态，不触发 React 渲染周期
            bgRef.current?.bgRender?.setFrequencyData(data.bass, data.mid, data.treble)
            rafRef.current = requestAnimationFrame(updateFreq)
        }
        rafRef.current = requestAnimationFrame(updateFreq)

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = 0
            }
        }
    }, [isVisible, isPlaying, audioVisualization])

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

    const syncDesktopSettings = (overrides: Partial<any> = {}) => {
        emit('player:settings-sync', {
            desktopLyricFontSize: overrides.desktopLyricFontSize || desktopLyricFontSize,
            desktopLyricColor: overrides.desktopLyricColor || desktopLyricColor,
            desktopLyricStrokeColor: overrides.desktopLyricStrokeColor || desktopLyricStrokeColor,
            ...overrides
        })
    }

    const openDesktopLyric = async () => {
        try {
            await invoke('open_desktop_lyric')
        } catch (error) {
            console.error('Failed to open desktop lyric:', error)
        }
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
        <div className={`fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col transition-all duration-500 ease-in-out ${isAnimatingOut ? 'opacity-0 translate-y-full' : 'opacity-100 translate-y-0'}`}>
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0 bg-black">
                <WebGLBackground
                    ref={bgRef}
                    album={currentTrack?.picUrl}
                    playing={isPlaying}
                    renderScale={0.25} // 降低渲染分辨率以提升性能
                    className="absolute inset-0 w-full h-full opacity-80"
                />
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Top Bar / Close Button */}
            <div data-tauri-drag-region className="relative z-[110] flex justify-between items-center px-6 py-4 lg:px-8 lg:py-4">
                <button
                    onClick={() => setIsFullscreen(false)}
                    className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10"
                >
                    <ChevronDown size={28} />
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10 ml-1">
                            <MoreHorizontal size={22} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 z-[200] bg-black/80 backdrop-blur-xl border-white/10 text-white">
                        <DropdownMenuLabel>播放器设置</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuCheckboxItem
                            checked={audioVisualization}
                            onCheckedChange={toggleAudioVisualization}
                            className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                        >
                            <Activity className="mr-2 h-4 w-4" />
                            音频律动
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuItem
                            onClick={openDesktopLyric}
                            className="focus:bg-white/10 focus:text-white"
                        >
                            <Monitor className="mr-2 h-4 w-4" />
                            桌面歌词
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <div className="px-2 py-1.5">
                            <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                                <Type className="mr-2 h-4 w-4" /> 歌词字号
                            </div>
                            <Slider
                                value={[lyricFontSize]}
                                max={60}
                                min={20}
                                step={1}
                                onValueChange={(v) => setLyricFontSize(v[0])}
                                className="w-full"
                            />
                        </div>
                        <div className="px-2 py-1.5 mb-1.5">
                            <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                                <Droplets className="mr-2 h-4 w-4" /> 背景模糊
                            </div>
                            <Slider
                                value={[lyricBlurStrength]}
                                max={20}
                                min={0}
                                step={1}
                                onValueChange={(v) => setLyricBlurStrength(v[0])}
                                className="w-full"
                            />
                        </div>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <div className="px-2 py-1.5">
                            <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                                <Monitor className="mr-2 h-4 w-4" /> 桌面歌词字号
                            </div>
                            <Slider
                                value={[desktopLyricFontSize]}
                                max={80}
                                min={20}
                                step={1}
                                onValueChange={(v) => {
                                    setDesktopLyricFontSize(v[0])
                                    syncDesktopSettings({ desktopLyricFontSize: v[0] })
                                }}
                                className="w-full"
                            />
                        </div>
                        <div className="px-2 py-1.5 flex flex-col gap-2">
                            <label className="flex items-center justify-between text-sm opacity-80 cursor-pointer">
                                <div className="flex items-center"><Baseline className="mr-2 h-4 w-4" /> 桌面歌词颜色</div>
                                <input
                                    type="color"
                                    value={desktopLyricColor}
                                    className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
                                    onChange={(e) => {
                                        setDesktopLyricColor(e.target.value)
                                        syncDesktopSettings({ desktopLyricColor: e.target.value })
                                    }}
                                />
                            </label>
                            <label className="flex items-center justify-between text-sm opacity-80 cursor-pointer">
                                <div className="flex items-center"><Palette className="mr-2 h-4 w-4" /> 桌面歌词描边</div>
                                <input
                                    type="color"
                                    value={desktopLyricStrokeColor}
                                    className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
                                    onChange={(e) => {
                                        setDesktopLyricStrokeColor(e.target.value)
                                        syncDesktopSettings({ desktopLyricStrokeColor: e.target.value })
                                    }}
                                />
                            </label>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
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
                                    variant="apple"
                                />
                            </div>
                            <div className="relative flex justify-between items-center text-[0.75rem] text-white/50 font-semibold tabular-nums tracking-wider px-1">
                                <span>{formatTime(isDraggingProgress.current ? localProgress * duration : currentTime)}</span>
                                <span className="absolute left-1/2 -translate-x-1/2 text-[0.6rem] text-white/80 bg-white/10 px-1.5 py-0.5 rounded-[4px] font-bold tracking-widest uppercase">
                                    Lossless
                                </span>
                                <span>-{formatTime(Math.max(0, duration - (isDraggingProgress.current ? localProgress * duration : currentTime)))}</span>
                            </div>
                        </div>

                        {/* Playback Buttons */}
                        <div className="flex items-center justify-center gap-8 lg:gap-12 mt-2 lg:mt-4 mb-2 lg:mb-6">
                            <button onClick={handleSkipPrevious} className="text-white/90 hover:text-white transition-all active:scale-90 p-2">
                                <img src="/icon/icon_rewind.svg" alt="Previous" className="w-10 h-10 lg:w-12 lg:h-12 invert brightness-200" style={{ filter: 'invert(1) brightness(100)' }} />
                            </button>
                            <button
                                onClick={handleTogglePlay}
                                className="text-white hover:text-white/90 active:scale-95 transition-all p-2"
                            >
                                {isPlaying ? (
                                    <img src="/icon/icon_pause.svg" alt="Pause" className="w-12 h-12 lg:w-14 lg:h-14" style={{ filter: 'invert(1) brightness(100)' }} />
                                ) : (
                                    <img src="/icon/icon_play.svg" alt="Play" className="w-12 h-12 lg:w-14 lg:h-14" style={{ filter: 'invert(1) brightness(100)' }} />
                                )}
                            </button>
                            <button onClick={handleSkipNext} className="text-white/90 hover:text-white transition-all active:scale-90 p-2">
                                <img src="/icon/icon_forward.svg" alt="Next" className="w-10 h-10 lg:w-12 lg:h-12 invert brightness-200" style={{ filter: 'invert(1) brightness(100)' }} />
                            </button>
                        </div>

                        {/* Volume Slider - Matching Progress Bar Width */}
                        <div className="flex items-center justify-between gap-3 text-white/40 group/volume mt-1 lg:mt-2 w-full">
                            <Volume size={16} className="shrink-0" />
                            <div className="flex-1 h-3 flex items-center">
                                <Slider
                                    value={[localVolume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                    onValueCommit={handleVolumeCommit}
                                    className="w-full opacity-60 group-hover/volume:opacity-100 transition-opacity"
                                    variant="apple"
                                />
                            </div>
                            <Volume2 size={20} className="shrink-0" />
                        </div>
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
