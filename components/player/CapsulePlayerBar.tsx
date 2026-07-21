"use client"

import React, { useRef, useState, useEffect, useCallback } from "react"
import {
    ChevronDown,
    Languages,
    SlidersHorizontal,
    Heart,
    Repeat,
    Repeat1,
    Shuffle,
    Info,
    Volume,
    Volume2,
    ListMusic
} from "lucide-react"
import { usePlayerStore, RepeatMode } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { playlistService } from "@/lib/services/playlistService"
import { Slider } from "@/components/ui/slider"
import { AudioVisualizer } from "./AudioVisualizer"

export interface CapsulePlayerBarProps {
    isImmersiveMode?: boolean
    isLightCover?: boolean
    coverColors?: string[]
    
    // Left panel actions (Optional for environments like DesktopPlayer that don't need minimize)
    onClose?: () => void
    isLyricsFolded?: boolean
    onToggleLyrics?: () => void
    rightPanelMode?: 'lyrics' | 'info' | 'eq'
    onChangeRightPanelMode?: (mode: 'lyrics' | 'info' | 'eq') => void
    
    // Translation
    hasTranslation?: boolean
    showTranslation?: boolean
    onToggleTranslation?: () => void
    
    // Artist click
    onArtistClick?: () => void

    // Fullscreen queue view
    onOpenPlaylist?: () => void
    
    // Standalone mode for secondary windows
    isStandalone?: boolean
}

export function CapsulePlayerBar({
    isImmersiveMode = false,
    isLightCover = false,
    coverColors = [],
    onClose,
    isLyricsFolded = false,
    onToggleLyrics,
    rightPanelMode = 'lyrics',
    onChangeRightPanelMode,
    hasTranslation = false,
    showTranslation = false,
    onToggleTranslation,
    onArtistClick,
    onOpenPlaylist,
    isStandalone = false
}: CapsulePlayerBarProps) {
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

    const [isInPlaylist, setIsInPlaylist] = useState(false)
    const [inPlaylistIds, setInPlaylistIds] = useState<string[]>([])

    // Sync progress
    useEffect(() => {
        if (!currentTrack) {
            setLocalProgress(0)
            return
        }
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress, currentTrack])

    // Sync volume
    useEffect(() => {
        if (!isDraggingVolume.current) {
            setLocalVolume(volume || 0)
        }
    }, [volume])

    // Check playlist status
    const checkPlaylistStatus = useCallback(async () => {
        if (currentTrack?.id && currentTrack?.source) {
            try {
                const status = await playlistService.checkTrackInPlaylists(currentTrack.id, currentTrack.source)
                setIsInPlaylist(status.inPlaylist)
                setInPlaylistIds(status.playlistIds || [])
            } catch (error) {
                console.error("Failed to check playlist status:", error)
            }
        } else {
            setIsInPlaylist(false)
            setInPlaylistIds([])
        }
    }, [currentTrack])

    useEffect(() => {
        checkPlaylistStatus()
    }, [checkPlaylistStatus])

    // Event Handlers
    const handleTogglePlay = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isStandalone) {
            import('@tauri-apps/api/event').then(({ emit }) => {
                emit("player:command", { type: "toggle-play" })
            })
        } else {
            playerService.togglePlay()
        }
    }

    const handleSkipPrevious = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isStandalone) {
            import('@tauri-apps/api/event').then(({ emit }) => emit("player:command", { type: "prev" }))
        } else {
            playerService.playPrev()
        }
    }

    const handleSkipNext = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isStandalone) {
            import('@tauri-apps/api/event').then(({ emit }) => emit("player:command", { type: "next" }))
        } else {
            playerService.playNext()
        }
    }

    const handleSeekChange = (val: number[]) => {
        isDraggingProgress.current = true
        setLocalProgress(val[0])
    }

    const handleSeekCommit = (val: number[]) => {
        if (currentTrack && duration > 0) {
            if (isStandalone) {
                import('@tauri-apps/api/event').then(({ emit }) => emit("player:seek", val[0] * duration))
            } else {
                playerService.seek(val[0] * duration)
            }
        }
        isDraggingProgress.current = false
    }

    const handleVolumeChange = (val: number[]) => {
        isDraggingVolume.current = true
        setLocalVolume(val[0])
        if (isStandalone) {
            import('@tauri-apps/api/event').then(({ emit }) => emit("player:command", { type: "set-volume", volume: val[0] }))
        } else {
            playerService.setVolume(val[0])
        }
    }

    const handleVolumeCommit = (val: number[]) => {
        isDraggingVolume.current = false
        if (isStandalone) {
            import('@tauri-apps/api/event').then(({ emit }) => emit("player:command", { type: "set-volume", volume: val[0] }))
        } else {
            playerService.setVolume(val[0])
        }
    }

    const handleHeartClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentTrack) return
        
        if (isInPlaylist && inPlaylistIds.length > 0) {
            try {
                await playlistService.removeTracksFromPlaylist(inPlaylistIds[0], [currentTrack])
                await checkPlaylistStatus()
            } catch (err) {
                console.error("Failed to remove track:", err)
            }
        } else {
            // Simplified for now, just logging. Or trigger a store event if we want the dialog.
            console.log("Add to playlist logic not implemented in standalone bar")
        }
    }

    const formatTime = (time: number) => {
        if (!time || !isFinite(time)) return "0:00"
        const mins = Math.floor(time / 60)
        const secs = Math.floor(time % 60)
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    return (
        <div className={`relative z-[120] flex justify-center items-center gap-4 transition-[filter] duration-500 ${isImmersiveMode && isLightCover ? '[&_button]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] [&_span]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] [&_img]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''}`}>
            {/* Left Capsule: Minimize + Toggle Lyrics */}
            <div className="relative flex items-center gap-2 border border-white/20 bg-black/20 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.16)] rounded-full px-4 py-2.5">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors p-1.5"
                        title="最小化播放器"
                    >
                        <ChevronDown size={20} />
                    </button>
                )}
                {onOpenPlaylist && (
                    <button
                        onClick={onOpenPlaylist}
                        className="p-1.5 text-white/50 transition-colors hover:text-white"
                        title="查看播放队列"
                    >
                        <ListMusic size={20} />
                    </button>
                )}
                {onToggleLyrics && (
                    <button
                        onClick={onToggleLyrics}
                        className={`p-1.5 transition-colors ${isLyricsFolded ? 'text-white' : 'text-white/50 hover:text-white'}`}
                        title={isLyricsFolded ? '展开歌词' : '折叠歌词'}
                    >
                        <img src="/icon/icon_lyrics.svg" alt="Lyrics" className="w-5 h-5" style={{ filter: 'invert(1) brightness(100)', opacity: isLyricsFolded ? 1 : 0.6 }} />
                    </button>
                )}
                
                {onToggleLyrics && onChangeRightPanelMode && <div className="w-[1px] h-4 bg-white/10 mx-1" />}
                
                {onChangeRightPanelMode && (
                    <>
                        <button
                            onClick={() => onChangeRightPanelMode(rightPanelMode === 'info' ? 'lyrics' : 'info')}
                            className={`p-1.5 rounded-full transition-colors ${rightPanelMode === 'info' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                            title={rightPanelMode === 'info' ? '显示歌词' : '切换歌曲信息'}
                        >
                            <Info size={20} />
                        </button>
                        <button
                            onClick={() => onChangeRightPanelMode(rightPanelMode === 'eq' ? 'lyrics' : 'eq')}
                            className={`p-1.5 rounded-full transition-colors ${rightPanelMode === 'eq' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                            title={rightPanelMode === 'eq' ? '关闭均衡器' : '均衡器设置'}
                        >
                            <SlidersHorizontal size={20} />
                        </button>
                    </>
                )}
                
                {hasTranslation && onToggleTranslation && (
                    <button
                        onClick={onToggleTranslation}
                        className={`p-1.5 rounded-full transition-colors ${showTranslation ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                        title={showTranslation ? '隐藏翻译' : '显示翻译'}
                    >
                        <Languages size={20} />
                    </button>
                )}
            </div>

            {/* Center Capsule: Song Info + Playback + Progress */}
            <div className="relative flex items-center gap-5 border border-white/20 bg-black/20 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.16)] rounded-full px-5 py-2.5 flex-1 max-w-[900px]">
                {/* Mini Cover + Info */}
                <div className="flex items-center gap-2.5 min-w-[140px] shrink-0">
                    {currentTrack?.picUrl ? (
                        <img src={currentTrack.picUrl} alt={currentTrack.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white/30 text-xs">♪</div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-bold text-white truncate">{currentTrack?.name || '未在播放'}</span>
                        <span
                            className={`text-[11px] truncate ${currentTrack?.source === 'netease' && onArtistClick ? 'text-white/50 hover:text-white/80 cursor-pointer transition-colors' : 'text-white/50'}`}
                            onClick={() => {
                                if (currentTrack?.source === 'netease' && onArtistClick) onArtistClick()
                            }}
                        >{currentTrack?.artists || '未知歌手'}</span>
                    </div>
                </div>

                {/* Playback Buttons */}
                <div className="flex items-center gap-4 shrink-0">
                    {/* Immersive Mode Audio Visualizer (compact) */}
                    {isImmersiveMode && (
                        <AudioVisualizer
                            colors={coverColors}
                            compact
                            isPlaying={isPlaying}
                            className="mr-1"
                        />
                    )}
                    <button onClick={handleSkipPrevious} className="text-white/80 hover:text-white transition-all active:scale-90">
                        <img src="/icon/icon_rewind.svg" alt="Previous" className="w-5 h-5" style={{ filter: 'invert(1) brightness(100)' }} />
                    </button>
                    <button onClick={handleTogglePlay} className="text-white hover:text-white/90 active:scale-95 transition-all">
                        {isPlaying
                            ? <img src="/icon/icon_pause.svg" alt="Pause" className="w-7 h-7" style={{ filter: 'invert(1) brightness(100)' }} />
                            : <img src="/icon/icon_play.svg" alt="Play" className="w-7 h-7" style={{ filter: 'invert(1) brightness(100)' }} />
                        }
                    </button>
                    <button onClick={handleSkipNext} className="text-white/80 hover:text-white transition-all active:scale-90">
                        <img src="/icon/icon_forward.svg" alt="Next" className="w-5 h-5" style={{ filter: 'invert(1) brightness(100)' }} />
                    </button>
                    {/* Heart Button */}
                    {currentTrack && (
                        <button onClick={handleHeartClick} className={`transition-all duration-300 ${isInPlaylist ? 'text-red-500' : 'text-white/50 hover:text-white/80'}`}>
                            <Heart size={18} fill={isInPlaylist ? "currentColor" : "none"} />
                        </button>
                    )}
                    {/* Repeat Mode Button */}
                    <button
                        onClick={() => {
                            const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
                            const currentIndex = modes.indexOf(repeatMode)
                            setRepeatMode(modes[(currentIndex + 1) % modes.length])
                        }}
                        className={`transition-colors ${repeatMode === RepeatMode.All ? 'text-white/50 hover:text-white/80' : 'text-white hover:text-white/90'}`}
                        title={repeatMode === RepeatMode.All ? '顺序播放' : repeatMode === RepeatMode.One ? '单曲循环' : '随机播放'}
                    >
                        {repeatMode === RepeatMode.One ? <Repeat1 size={18} /> : repeatMode === RepeatMode.Shuffle ? <Shuffle size={18} /> : <Repeat size={18} />}
                    </button>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="text-[11px] text-white/50 font-semibold tabular-nums shrink-0">{formatTime(isDraggingProgress.current ? localProgress * duration : currentTime)}</span>
                    <div className="flex-1 h-3 flex items-center">
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
                    <span className="text-[11px] text-white/50 font-semibold tabular-nums shrink-0">{formatTime(Math.max(0, duration - (isDraggingProgress.current ? localProgress * duration : currentTime)))}</span>
                </div>
            </div>

            {/* Right Capsule: Volume (expands left on hover) */}
            <div className="relative group/volbtn flex items-center h-12 border border-white/20 bg-black/20 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.16)] rounded-full overflow-hidden transition-all duration-300 ease-in-out w-12 hover:w-[200px]">
                {/* Slider (visible on hover) */}
                <div className="flex items-center gap-2 pl-3.5 pr-1 opacity-0 group-hover/volbtn:opacity-100 transition-opacity duration-300 absolute left-0 top-0 bottom-0 right-12 z-10">
                    <Volume size={14} className="text-white/50 shrink-0" />
                    <div className="flex-1 h-3 flex items-center">
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
                {/* Icon (always visible, anchored right) */}
                <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 text-white/70 group-hover/volbtn:text-white transition-colors">
                    <Volume2 size={20} />
                </div>
            </div>
        </div>
    )
}
