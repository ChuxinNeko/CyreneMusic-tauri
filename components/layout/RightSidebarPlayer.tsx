"use client"

import React from "react"
import { X, Play, Music2 } from "lucide-react"
import { emit } from "@tauri-apps/api/event"
import { invoke, convertFileSrc } from "@tauri-apps/api/core"
import { usePlayerStore, RepeatMode, LyricDisplayStyle } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { playlistService } from "@/lib/services/playlistService"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { AsyncImage } from "@/components/common/AsyncImage"
import { LyricPlayer } from "../player/LyricPlayer"
import { LyricPlayerSingleLine } from "../player/LyricPlayerSingleLine"
import { LyricPlayerRoulette } from "../player/LyricPlayerRoulette"
import { WebGLBackground } from "../player/WebGLBackground"
import { SongInfoPanel } from "../player/song-info/SongInfoPanel"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { artistService } from "@/lib/services/artistService"
import { useRouter } from "next/navigation"

export function RightSidebarPlayer({ isStandalone = false }: { isStandalone?: boolean }) {
    const isRightSidebarPlayerEnabled = useLayoutStore(s => s.isRightSidebarPlayerEnabled)
    
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const lyricDisplayStyle = usePlayerStore(s => s.lyricDisplayStyle)

    const playerBgType = usePlayerStore(s => s.playerBgType)
    const customBgPath = usePlayerStore(s => s.customBgPath)
    const customBgBlur = usePlayerStore(s => s.customBgBlur)
    const customBgBrightness = usePlayerStore(s => s.customBgBrightness)
    const customBgScale = usePlayerStore(s => s.customBgScale)
    const customBgOverlay = usePlayerStore(s => s.customBgOverlay)

    const queue = usePlayerStore(s => s.queue)

    const [activeTab, setActiveTab] = React.useState<'lyrics' | 'playlist'>('lyrics')

    const router = useRouter()

    // If not standalone and not enabled, return null. Standalone ignores the enable state (or it wouldn't have been opened)
    if (!isStandalone && !isRightSidebarPlayerEnabled) return null

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
                    <WebGLBackground
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

            {/* Top Tabs */}
            <div className="flex w-full items-center justify-start px-6 pt-6 pb-2 relative z-10 shrink-0" data-tauri-drag-region>
                <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button 
                        onClick={() => setActiveTab('lyrics')}
                        className={`relative pb-2 text-sm font-bold transition-all ${activeTab === 'lyrics' ? 'text-white/80' : 'text-white/40 hover:text-white/60'}`}
                    >
                        歌词
                        {activeTab === 'lyrics' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/80 rounded-full" />
                        )}
                    </button>
                    <button 
                        onClick={() => setActiveTab('playlist')}
                        className={`relative pb-2 text-sm font-bold transition-all ${activeTab === 'playlist' ? 'text-white/80' : 'text-white/40 hover:text-white/60'}`}
                    >
                        播放列表
                        {activeTab === 'playlist' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/80 rounded-full" />
                        )}
                    </button>
                </div>
                {/* Close button for standalone */}
                {isStandalone && (
                    <button 
                        onClick={() => {
                            useLayoutStore.getState().setRightSidebarPlayerEnabled(false)
                            invoke("close_table_player")
                        }} 
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors z-10"
                        style={{ WebkitAppRegion: 'no-drag' } as any}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {activeTab === 'lyrics' ? (
                <div className="flex-1 w-full relative z-10 px-4 pb-4 pt-2 overflow-hidden" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    {lyricDisplayStyle === LyricDisplayStyle.Roulette ? <LyricPlayerRoulette /> :
                     lyricDisplayStyle === LyricDisplayStyle.SingleLine ? <LyricPlayerSingleLine /> :
                     <LyricPlayer alignPosition="top-second" />}
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
            )}
        </aside>
    )
}
