"use client"

import React from "react"
import dynamic from "next/dynamic"
import { X, Play, Pause, SkipBack, SkipForward, Music2, ListMusic, Mic2, Minus, Maximize2, Volume2, MoreHorizontal, MessageSquareQuote, Pin, ChevronDown, ChevronUp } from "lucide-react"
import { emit } from "@tauri-apps/api/event"
import { invoke, convertFileSrc } from "@tauri-apps/api/core"
import { usePlayerStore, RepeatMode, LyricDisplayStyle } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { LyricSettingsProvider } from "@/components/player/LyricSettingsContext"
import { playerService } from "@/lib/services/playerService"
import { Slider } from "@/components/ui/slider"
import { AsyncImage } from "@/components/common/AsyncImage"
import { LyricPlayerSingleLine } from "../player/LyricPlayerSingleLine"
import { LyricPlayerRoulette } from "../player/LyricPlayerRoulette"
const AMLLLyricPlayer = dynamic(() => import("../player/AMLLLyricPlayer").then(m => m.AMLLLyricPlayer), { ssr: false })
const AMLLBackground = dynamic(() => import("../player/AMLLBackground").then(m => m.AMLLBackground), { ssr: false })
import { extractColorsFromImage } from "@/lib/utils/extractColors"
import { SmokeVisualizer } from "../player/SmokeVisualizer"
import { SongInfoPanel } from "../player/song-info/SongInfoPanel"
import { useLayoutStore } from "@/lib/store/useLayoutStore"

function formatTime(seconds: number) {
    if (!seconds || !isFinite(seconds)) return "0:00"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
}

const SvgIcon = ({ src, size = 18, className = '' }: { src: string, size?: number, className?: string }) => (
    <div 
        className={`bg-current inline-block ${className}`}
        style={{
            width: size,
            height: size,
            WebkitMaskImage: `url('${src}')`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskImage: `url('${src}')`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
        }}
    />
)

const GlassSlider = ({ value, max, onValueChange, onValueCommit, className }: { value: number[], max: number, onValueChange: (val: number[]) => void, onValueCommit?: (val: number[]) => void, className?: string }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const lastValueRef = React.useRef(value[0]);
    
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!trackRef.current) return;
        e.preventDefault();
        const track = trackRef.current;
        const rect = track.getBoundingClientRect();
        
        const updateValue = (clientX: number) => {
            let percentage = (clientX - rect.left) / rect.width;
            percentage = Math.max(0, Math.min(1, percentage));
            const finalVal = percentage * max;
            lastValueRef.current = finalVal;
            onValueChange([finalVal]);
        };
        
        updateValue(e.clientX);
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            updateValue(moveEvent.clientX);
        };
        
        const handlePointerUp = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            if (onValueCommit) {
                onValueCommit([lastValueRef.current]);
            }
        };
        
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const percentage = max > 0 ? (value[0] / max) * 100 : 0;

    return (
        <div 
            ref={trackRef}
            className={`relative flex items-center cursor-pointer group ${className}`}
            onPointerDown={handlePointerDown}
        >
            <div className="absolute inset-0 w-full h-full rounded-full bg-white/20 backdrop-blur-md overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
                <div 
                    className="absolute left-0 top-0 bottom-0 bg-white/90 rounded-full transition-all duration-75 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div 
                className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)] opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                style={{ left: `calc(${percentage}% - 5px)` }}
            />
        </div>
    );
};

export function RightSidebarPlayer({ isStandalone = false }: { isStandalone?: boolean }) {
    const isRightSidebarPlayerEnabled = useLayoutStore(s => s.isRightSidebarPlayerEnabled)

    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const progress = usePlayerStore(s => s.progress)
    const currentTime = usePlayerStore(s => s.currentTime)
    const duration = usePlayerStore(s => s.duration)
    const lyricDisplayStyle = useFullscreenSettingsStore(s => s.lyricDisplayStyle)
    const remoteBarData = usePlayerStore(s => s.remoteBarData)

    const playerBgType = useFullscreenSettingsStore(s => s.playerBgType)
    const customBgPath = useFullscreenSettingsStore(s => s.customBgPath)
    const customBgBlur = useFullscreenSettingsStore(s => s.customBgBlur)
    const customBgBrightness = useFullscreenSettingsStore(s => s.customBgBrightness)
    const customBgScale = useFullscreenSettingsStore(s => s.customBgScale)
    const customBgOverlay = useFullscreenSettingsStore(s => s.customBgOverlay)

    const queue = usePlayerStore(s => s.queue)

    const [activeTab, setActiveTab] = React.useState<'lyrics' | 'playlist'>('lyrics')
    const [themeColor, setThemeColor] = React.useState<string | undefined>()

    // Use a ref to store latest remoteBarData to avoid resetting the interval
    const remoteBarDataRef = React.useRef(remoteBarData)
    React.useEffect(() => {
        remoteBarDataRef.current = remoteBarData
    }, [remoteBarData])

    // Log audio spectrum data every 5 seconds
    React.useEffect(() => {
        if (!isPlaying) return
        const interval = setInterval(() => {
            const data = remoteBarDataRef.current
            if (data && data.length > 0) {
                console.log("[Audio Spectrum] remoteBarData (len: " + data.length + "):", data)
            } else {
                import("@/lib/services/audioAnalyser").then(({ audioAnalyser }) => {
                    console.log("[Audio Spectrum] local freq data:", audioAnalyser.getFrequencyData())
                    // Uncomment below if you also want to log raw bars
                    // console.log("[Audio Spectrum] local bar data:", audioAnalyser.getBarData(48))
                })
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [isPlaying])

    // 从专辑封面提取主题色
    React.useEffect(() => {
        if (!currentTrack?.picUrl) {
            setThemeColor(undefined)
            return
        }
        extractColorsFromImage(currentTrack.picUrl)
            .then(colors => {
                if (colors[0]) setThemeColor(colors[0])
            })
            .catch(() => setThemeColor(undefined))
    }, [currentTrack?.picUrl])
    const [isPinned, setIsPinned] = React.useState(false)
    const [isCollapsed, setIsCollapsed] = React.useState(false)
    const savedHeightRef = React.useRef<number | null>(null)

    // 获取初始置顶状态
    React.useEffect(() => {
        if (isStandalone) {
            invoke<boolean>("get_table_player_pin_state")
                .then(setIsPinned)
                .catch(console.error)
        }
    }, [isStandalone])

    const handleTogglePin = async () => {
        try {
            const newState = await invoke<boolean>("toggle_table_player_pin")
            setIsPinned(newState)
        } catch (e) {
            console.error("Failed to toggle pin:", e)
        }
    }

    const handleToggleCollapse = async () => {
        const newCollapsed = !isCollapsed
        setIsCollapsed(newCollapsed)

        // 在 standalone 模式下调整窗口高度
        if (isStandalone) {
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window")
                const win = getCurrentWindow()
                const currentSize = await win.innerSize()
                const currentLogicalHeight = currentSize.height / window.devicePixelRatio
                const currentLogicalWidth = currentSize.width / window.devicePixelRatio

                if (newCollapsed) {
                    // 折叠时保存当前高度，然后缩小窗口
                    savedHeightRef.current = currentLogicalHeight
                    await win.setSize({ type: "Logical", width: currentLogicalWidth, height: 160 })
                } else {
                    // 展开时恢复保存的高度，如果没有保存则使用默认值
                    const restoreHeight = savedHeightRef.current || 600
                    await win.setSize({ type: "Logical", width: currentLogicalWidth, height: restoreHeight })
                    savedHeightRef.current = null
                }
            } catch (e) {
                console.error("Failed to resize window:", e)
            }
        }
    }

    // If not standalone and not enabled, return null
    if (!isStandalone && !isRightSidebarPlayerEnabled) return null

    const handleTogglePlay = () => {
        if (isStandalone) {
            emit("player:command", { type: "toggle-play" })
        } else {
            playerService.togglePlay()
        }
    }

    const handlePrev = () => {
        if (isStandalone) {
            emit("player:command", { type: "prev" })
        } else {
            playerService.playPrevious()
        }
    }

    const handleNext = () => {
        if (isStandalone) {
            emit("player:command", { type: "next" })
        } else {
            playerService.playNext()
        }
    }

    // 本地视觉进度状态，用于在拖拽时脱离全局状态独立更新，避免进度条抽搐回弹
    const [localProgress, setLocalProgress] = React.useState<number | null>(null)

    // 每当真实的 progress 更新时，如果我们没有在拖拽，组件会自动使用全局 progress。
    React.useEffect(() => {
        if (localProgress === null) return
    }, [progress])

    const handleSeekChange = (value: number[]) => {
        setLocalProgress(value[0]) // 拖拽中，仅更新本地视觉状态，不发送 IPC
    }

    const handleSeekCommit = (value: number[]) => {
        if (isStandalone) {
            emit("player:seek", value[0] * duration)
        } else {
            playerService.seek(value[0] * duration)
        }
        setLocalProgress(null) // 提交后，恢复追踪全局状态
    }

    return (
        <aside
            className={`shrink-0 h-full flex flex-col overflow-hidden transition-all duration-300 relative text-white ${
                isStandalone
                    ? "w-full"
                    : "w-[320px] border-l border-white/10 hidden lg:flex"
            }`}
        >
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0 bg-black pointer-events-none">
                {playerBgType === 'image' && customBgPath ? (
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `url(${convertFileSrc(customBgPath)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: `blur(${customBgBlur}px) brightness(${customBgBrightness}%)`,
                            transform: `scale(${customBgScale / 100})`,
                            transition: 'filter 200ms ease, transform 200ms ease',
                        }}
                    />
                ) : (
                    <AMLLBackground
                        album={currentTrack?.picUrl}
                        playing={isPlaying}
                        fps={60}
                        renderScale={0.15}
                        className="absolute inset-0 w-full h-full opacity-80"
                    />
                )}
                <div
                    className="absolute inset-0 bg-black"
                    style={{ opacity: playerBgType === 'image' && customBgPath ? customBgOverlay / 100 : 0.4 }}
                />
            </div>

            {/* Mini Player Section */}
            <div className="relative z-10 shrink-0 px-5 pt-5 pb-2" data-tauri-drag-region>
                {/* Top Section: Album Art & Info & Window Controls */}
                <div className="flex relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    {/* Left: Album Art */}
                    <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 shadow-md bg-white/5">
                        <AsyncImage
                            src={currentTrack?.picUrl}
                            alt={currentTrack?.name || ""}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Center: Info */}
                    <div className="flex-1 px-4 flex flex-col justify-center min-w-0 pr-12">
                        <p className="text-sm font-bold truncate text-white w-full text-center tracking-wide">
                            {currentTrack?.name || "未在播放"}
                        </p>
                        <p className="text-xs text-white/60 truncate w-full text-center mt-1">
                            {currentTrack?.artists || "—"} {currentTrack?.album?.name ? `— ${currentTrack.album.name}` : ""}
                        </p>
                    </div>

                    {/* Right: Window Controls */}
                    <div className="absolute top-0 right-0 flex items-center gap-2.5 text-white/50">
                        {isStandalone && (
                            <button
                                className={`hover:text-white transition-colors ${isPinned ? 'text-white' : ''}`}
                                onClick={handleTogglePin}
                                title={isPinned ? "取消置顶" : "置顶窗口"}
                            >
                                <Pin size={14} className={isPinned ? 'fill-current' : ''} />
                            </button>
                        )}
                        <button 
                            className="hover:text-white transition-colors"
                            onClick={() => emit("player:command", { type: "toggle-fullscreen" })}
                            title="全屏播放程序"
                        >
                            <Maximize2 size={13} />
                        </button>
                        {isStandalone && (
                            <button 
                                onClick={() => {
                                    useLayoutStore.getState().setRightSidebarPlayerEnabled(false)
                                    invoke("close_table_player")
                                }}
                                className="hover:text-white transition-colors"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 flex items-center gap-3 text-[10px] text-white/60 font-medium" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <span className="w-8 text-left tabular-nums">{formatTime(localProgress !== null ? localProgress * duration : currentTime)}</span>
                    <GlassSlider
                        value={[localProgress !== null ? localProgress : progress]}
                        max={1}
                        onValueChange={handleSeekChange}
                        onValueCommit={handleSeekCommit}
                        className="flex-1 h-1.5"
                    />
                    <span className="w-8 text-right tabular-nums">-{formatTime(Math.max(0, duration - (localProgress !== null ? localProgress * duration : currentTime)))}</span>
                </div>

                {/* Playback Controls & Other Buttons */}
                <div className="mt-3 flex items-center justify-between px-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    {/* Left group */}
                    <div className="flex items-center gap-3 text-white/60">
                        <button
                            onClick={handleToggleCollapse}
                            className="hover:text-white transition-colors p-1"
                            title={isCollapsed ? "展开面板" : "折叠面板"}
                        >
                            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button className="hover:text-white transition-colors">
                            <Volume2 size={16} />
                        </button>
                    </div>

                    {/* Center group */}
                    <div className="flex items-center gap-5">
                        <button onClick={handlePrev} className="text-white/80 hover:text-white transition-colors p-1 flex items-center justify-center">
                            <SvgIcon src="/icon/icon_rewind.svg" size={20} />
                        </button>
                        <button onClick={handleTogglePlay} className="text-white hover:scale-105 transition-transform p-1 flex items-center justify-center">
                            {isPlaying ? <SvgIcon src="/icon/icon_pause.svg" size={24} /> : <SvgIcon src="/icon/icon_play.svg" size={24} />}
                        </button>
                        <button onClick={handleNext} className="text-white/80 hover:text-white transition-colors p-1 flex items-center justify-center">
                            <SvgIcon src="/icon/icon_forward.svg" size={20} />
                        </button>
                    </div>

                    {/* Right group */}
                    <div className="flex items-center gap-2 text-white/60">
                        <button 
                            onClick={() => setActiveTab('lyrics')}
                            className={`transition-colors p-1.5 rounded-full flex items-center justify-center ${activeTab === 'lyrics' ? 'bg-white/25 text-white' : 'hover:text-white'}`}
                            title="显示或隐藏歌词"
                        >
                            <SvgIcon src="/icon/icon_lyrics.svg" size={18} />
                        </button>
                        <button 
                            onClick={() => setActiveTab('playlist')}
                            className={`transition-colors p-1.5 rounded-full flex items-center justify-center ${activeTab === 'playlist' ? 'bg-white/25 text-white' : 'hover:text-white'}`}
                            title="打开“待播清单”列表"
                        >
                            <ListMusic size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {!isCollapsed && (activeTab === 'lyrics' ? (
                <div className="flex-1 w-full relative z-10 px-4 pb-4 pt-1 overflow-hidden" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <LyricSettingsProvider scope="fullscreen">
                        {lyricDisplayStyle === LyricDisplayStyle.Roulette ? <LyricPlayerRoulette /> :
                         lyricDisplayStyle === LyricDisplayStyle.SingleLine ? <LyricPlayerSingleLine /> :
                         <AMLLLyricPlayer />}
                    </LyricSettingsProvider>
                </div>
            ) : (
                <div className="flex-1 min-h-0 relative z-10 overflow-y-auto px-4 pb-4 space-y-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    {queue.length > 0 ? (
                        queue.map((track, index) => {
                            const isCurrent = currentTrack?.id === track.id && currentTrack?.source === track.source
                            return (
                                <div
                                    key={`${track.id}-${track.source}-${index}`}
                                    onClick={() => isStandalone ? emit("player:command", { type: "play-track", track }) : playerService.playTrack(track)}
                                    className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all duration-300 border border-transparent ${
                                        isCurrent ? "bg-white/20 border-white/30 shadow-sm" : "hover:bg-white/10 hover:border-white/20"
                                    }`}
                                >
                                    <div className="relative h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden shadow-sm bg-white/5">
                                        <AsyncImage src={track.picUrl} alt={track.name} className="h-full w-full object-cover" />
                                        {isCurrent && isPlaying ? (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="flex items-end gap-[1.5px] h-3">
                                                    <div className="w-0.5 bg-white animate-[music-bar-1_0.8s_ease-in-out_infinite]" />
                                                    <div className="w-0.5 bg-white animate-[music-bar-2_0.8s_ease-in-out_infinite]" />
                                                    <div className="w-0.5 bg-white animate-[music-bar-3_0.8s_ease-in-out_infinite]" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Play className="h-4 w-4 text-white fill-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2">
                                        <h4 className={`text-sm font-bold truncate tracking-tight transition-colors ${isCurrent ? "text-white" : "text-white/90 group-hover:text-white"}`}>
                                            {track.name}
                                        </h4>
                                        <p className="text-[11px] font-medium text-white/50 truncate">
                                            {track.artists}
                                        </p>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-2">
                            <Music2 className="h-10 w-10 text-white/30" />
                            <p className="text-sm font-bold text-white">队列空空如也</p>
                        </div>
                    )}
                    <style jsx global>{`
                        @keyframes music-bar-1 { 0%, 100% { height: 4px; } 50% { height: 12px; } }
                        @keyframes music-bar-2 { 0%, 100% { height: 12px; } 50% { height: 6px; } }
                        @keyframes music-bar-3 { 0%, 100% { height: 7px; } 50% { height: 14px; } }
                    `}</style>
                </div>
            ))}

            <div className="absolute bottom-0 left-0 w-full z-[5] pointer-events-none mix-blend-screen opacity-70 transition-opacity duration-500">
                <SmokeVisualizer 
                    isPlaying={isPlaying} 
                    externalBarData={remoteBarData} 
                    themeColor={themeColor || "#4ECDC4"} 
                    height={isCollapsed ? "120px" : "180px"} 
                />
            </div>
        </aside>
    )
}