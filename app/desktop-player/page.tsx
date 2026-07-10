"use client"

import React, { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { usePlayerStore, LyricDisplayStyle } from "@/lib/store/usePlayerStore"
import { useDesktopPlayerStore } from "@/lib/store/useDesktopPlayerStore"
import { LyricSettingsProvider } from "@/components/player/LyricSettingsContext"
import { useRemotePlayerSync } from "@/hooks/useRemotePlayerSync"
import { LyricPlayerSingleLine } from "@/components/player/LyricPlayerSingleLine"
import { LyricPlayerRoulette } from "@/components/player/LyricPlayerRoulette"
import { PlayerSettingsMenu } from "@/components/player/PlayerSettingsMenu"
import { Check, Settings } from "lucide-react"

const AMLLLyricPlayer = dynamic(() => import("@/components/player/AMLLLyricPlayer").then(m => m.AMLLLyricPlayer), { ssr: false })

export default function DesktopPlayerPage() {
    const [mounted, setMounted] = useState(false)
    const currentTrack = usePlayerStore(s => s.currentTrack)

    // 桌面播放器独立设置
    const lyricDisplayStyle = useDesktopPlayerStore(s => s.lyricDisplayStyle)
    const hideAlbumCover = useDesktopPlayerStore(s => s.hideAlbumCover)

    const desktopLyricRotationX = useDesktopPlayerStore(s => s.desktopLyricRotationX)
    const desktopLyricRotationY = useDesktopPlayerStore(s => s.desktopLyricRotationY)
    const desktopLyricRotationZ = useDesktopPlayerStore(s => s.desktopLyricRotationZ)
    const desktopLyricPerspective = useDesktopPlayerStore(s => s.desktopLyricPerspective)

    const isLyricEditorMode = useDesktopPlayerStore(s => s.isLyricEditorMode)
    const lyricOffsetX = useDesktopPlayerStore(s => s.lyricOffsetX)
    const lyricOffsetY = useDesktopPlayerStore(s => s.lyricOffsetY)
    const setLyricOffsetX = useDesktopPlayerStore(s => s.setLyricOffsetX)
    const setLyricOffsetY = useDesktopPlayerStore(s => s.setLyricOffsetY)
    const setIsLyricEditorMode = useDesktopPlayerStore(s => s.setIsLyricEditorMode)

    const [isDragging, setIsDragging] = useState(false)
    const dragStart = React.useRef({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 })

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isLyricEditorMode) return;
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            initialOffsetX: lyricOffsetX,
            initialOffsetY: lyricOffsetY,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setLyricOffsetX(dragStart.current.initialOffsetX + dx);
        setLyricOffsetY(dragStart.current.initialOffsetY + dy);
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isDragging) {
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    }

    const handleFinishEditing = () => {
        setIsLyricEditorMode(false)
    }

    const isRemotePlayerReady = useRemotePlayerSync()

    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key !== "player-storage" || !e.newValue) return

            try {
                const parsed = JSON.parse(e.newValue)
                usePlayerStore.setState({
                    ...(parsed.state?.queue ? { queue: parsed.state.queue } : {}),
                    ...(parsed.state?.volume !== undefined ? { volume: parsed.state.volume } : {}),
                })
            } catch {
                // 持久化数据损坏时，以远端状态同步作为恢复来源。
            }
        }

        window.addEventListener("storage", handleStorage)
        return () => window.removeEventListener("storage", handleStorage)
    }, [])

    if (!isRemotePlayerReady) return null

    return (
        <LyricSettingsProvider scope="desktop">
            <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-end bg-transparent">
                {/* Top Left Settings Button */}
                <div className="absolute top-8 left-8 z-[100] pointer-events-auto">
                    <PlayerSettingsMenu triggerIcon={<Settings size={24} />} align="start" scope="desktop" />
                </div>

                {isLyricEditorMode && (
                    <button
                        type="button"
                        onClick={handleFinishEditing}
                        className="absolute top-8 right-8 z-[100] pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-white/20"
                    >
                        <Check size={16} />
                        完成编辑
                    </button>
                )}

                {/* Main Content Area (Cover + Lyrics) */}
                <div className={`absolute inset-0 top-[10vh] bottom-[200px] px-[8vw] flex items-center pointer-events-none ${hideAlbumCover ? 'justify-center' : 'justify-between'}`}>
                    
                    {/* Left: Album Cover */}
                    {!hideAlbumCover && (
                        <div className="w-[35%] max-w-[450px] aspect-square flex-shrink-0 flex items-center justify-center relative drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-700">
                            {currentTrack?.picUrl ? (
                                <div className="relative w-full h-full rounded-2xl overflow-hidden pointer-events-auto group">
                                    {/* CD Background effect */}
                                    <div className="absolute top-0 right-[-15%] w-full h-full bg-black/90 rounded-full border border-white/10 shadow-2xl flex items-center justify-center -z-10 group-hover:right-[-25%] transition-all duration-700">
                                        <div className="w-1/4 h-1/4 bg-black rounded-full border-2 border-white/20"></div>
                                    </div>
                                    <img
                                        src={currentTrack.picUrl}
                                        alt={currentTrack.name}
                                        className="w-full h-full object-cover rounded-2xl border border-white/10"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center">
                                    <span className="text-white/30 text-2xl font-bold tracking-widest">CYRENE MUSIC</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Right: Lyrics Panel */}
                    <div 
                        className={`h-full flex flex-col pointer-events-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] drop-shadow-[0_0_2px_rgba(0,0,0,1)] ${isDragging ? '' : 'transition-all duration-700'} ${hideAlbumCover ? 'w-[80%] max-w-5xl' : 'w-[55%]'} ${isLyricEditorMode ? 'ring-2 ring-white/50 bg-white/5 cursor-move rounded-xl' : ''}`}
                        style={{
                            perspective: `${desktopLyricPerspective}px`,
                            transformStyle: 'preserve-3d',
                            transform: `translate(${lyricOffsetX}px, ${lyricOffsetY}px)`,
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    >
                        <div 
                            className="h-full relative mask-image-vertical transition-transform duration-300 ease-out origin-center"
                            style={{
                                transform: `rotateX(${desktopLyricRotationX}deg) rotateY(${desktopLyricRotationY}deg) rotateZ(${desktopLyricRotationZ}deg)`
                            }}
                        >
                            <div className="absolute inset-0">
                                {lyricDisplayStyle === LyricDisplayStyle.Roulette ? (
                                    <LyricPlayerRoulette />
                                ) : lyricDisplayStyle === LyricDisplayStyle.SingleLine ? (
                                    <LyricPlayerSingleLine />
                                ) : (
                                    <AMLLLyricPlayer />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Styles for masking */}
                <style jsx global>{`
                    .mask-image-vertical {
                        mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
                        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
                    }
                    .amll-centered .amll-lyric-line {
                        text-align: center !important;
                        justify-content: center !important;
                    }
                    .amll-centered .amll-lyric-line * {
                        text-align: center !important;
                    }
                `}</style>
            </div>
        </LyricSettingsProvider>
    )
}