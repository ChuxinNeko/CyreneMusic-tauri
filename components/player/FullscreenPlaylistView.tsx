"use client"

import React from "react"
import { ArrowLeft, ListMusic, Music2, Pause, Play, RotateCcw } from "lucide-react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { playerService } from "@/lib/services/playerService"
import { convertFileSrc } from "@tauri-apps/api/core"
import dynamic from "next/dynamic"
import type { Track } from "@/lib/models/track"

const AMLLBackground = dynamic(() => import("./AMLLBackground").then(m => m.AMLLBackground), { ssr: false })
const WallpaperBackground = dynamic(() => import("./WallpaperBackground").then(m => m.WallpaperBackground), { ssr: false })

type FullscreenPlaylistViewProps = {
    onBack: () => void
}

type CanvasPoint = {
    x: number
    y: number
}

type VisibleCard = {
    key: string
    track: Track
    index: number
    x: number
    y: number
}

const CARD_WIDTH = 240
const CARD_HEIGHT = 340
const GRID_COLS = 5
const GRID_GAP_X = 28
const GRID_GAP_Y = 40

// 球面效果：中心放大、边缘缩小
const SPHERE_MAX_SCALE = 1.0
const SPHERE_MIN_SCALE = 0.5
const SPHERE_MAX_OPACITY = 1.0
const SPHERE_MIN_OPACITY = 0.35

const getGridSize = (total: number) => {
    const totalRows = Math.ceil(total / GRID_COLS)
    const width = GRID_COLS * CARD_WIDTH + (GRID_COLS - 1) * GRID_GAP_X
    const height = totalRows * CARD_HEIGHT + (totalRows - 1) * GRID_GAP_Y
    return { width, height }
}

const getSphereEffect = (
    cardX: number,
    cardY: number,
    pan: CanvasPoint,
    zoom: number,
    viewportWidth: number,
    viewportHeight: number,
    isActive: boolean,
): { scale: number; opacity: number } => {
    const screenX = cardX * zoom + pan.x
    const screenY = cardY * zoom + pan.y
    const halfW = viewportWidth / 2
    const halfH = viewportHeight / 2
    const ndx = halfW > 0 ? screenX / halfW : 0
    const ndy = halfH > 0 ? screenY / halfH : 0
    const dist = Math.min(1, Math.sqrt(ndx * ndx + ndy * ndy))
    const sphereFactor = 1 - Math.cos(dist * Math.PI / 2)
    const sphereScale = SPHERE_MAX_SCALE - (SPHERE_MAX_SCALE - SPHERE_MIN_SCALE) * sphereFactor
    const sphereOpacity = SPHERE_MAX_OPACITY - (SPHERE_MAX_OPACITY - SPHERE_MIN_OPACITY) * sphereFactor
    return {
        scale: sphereScale * (isActive ? 1.08 : 1),
        opacity: isActive ? 1.0 : sphereOpacity,
    }
}

// 虚拟化 + 循环：只返回视口内可见的卡片实例
const getVisibleCards = (
    queue: Track[],
    pan: CanvasPoint,
    zoom: number,
    viewportSize: { width: number; height: number },
): VisibleCard[] => {
    const total = queue.length
    if (total === 0) return []

    const { width: gridWidth, height: gridHeight } = getGridSize(total)

    // 视口在画布坐标系中的范围
    const viewLeft = (-pan.x - viewportSize.width / 2) / zoom
    const viewTop = (-pan.y - viewportSize.height / 2) / zoom
    const viewRight = viewLeft + viewportSize.width / zoom
    const viewBottom = viewTop + viewportSize.height / zoom

    // 缓冲区：多渲染一圈卡片，避免拖拽时闪烁
    const bufferX = CARD_WIDTH + GRID_GAP_X
    const bufferY = CARD_HEIGHT + GRID_GAP_Y

    // 循环：计算视口覆盖了哪些画布副本
    const startCopyX = Math.floor((viewLeft - bufferX) / gridWidth)
    const endCopyX = Math.ceil((viewRight + bufferX) / gridWidth)
    const startCopyY = Math.floor((viewTop - bufferY) / gridHeight)
    const endCopyY = Math.ceil((viewBottom + bufferY) / gridHeight)

    const totalRows = Math.ceil(total / GRID_COLS)
    const colStep = CARD_WIDTH + GRID_GAP_X
    const rowStep = CARD_HEIGHT + GRID_GAP_Y

    const visible: VisibleCard[] = []

    for (let copyY = startCopyY; copyY <= endCopyY; copyY++) {
        for (let copyX = startCopyX; copyX <= endCopyX; copyX++) {
            const offsetX = copyX * gridWidth
            const offsetY = copyY * gridHeight

            // 只遍历这个副本中可见的行列，不遍历全部卡片
            const startCol = Math.max(0, Math.floor((viewLeft - bufferX - offsetX + gridWidth / 2 - CARD_WIDTH / 2) / colStep))
            const endCol = Math.min(GRID_COLS - 1, Math.ceil((viewRight + bufferX - offsetX + gridWidth / 2 - CARD_WIDTH / 2) / colStep))
            const startRow = Math.max(0, Math.floor((viewTop - bufferY - offsetY + gridHeight / 2 - CARD_HEIGHT / 2) / rowStep))
            const endRow = Math.min(totalRows - 1, Math.ceil((viewBottom + bufferY - offsetY + gridHeight / 2 - CARD_HEIGHT / 2) / rowStep))

            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const i = row * GRID_COLS + col
                    if (i >= total) continue

                    const baseX = col * colStep - gridWidth / 2 + CARD_WIDTH / 2
                    const baseY = row * rowStep - gridHeight / 2 + CARD_HEIGHT / 2
                    visible.push({
                        key: `${i}-${copyX}-${copyY}`,
                        track: queue[i],
                        index: i,
                        x: baseX + offsetX,
                        y: baseY + offsetY,
                    })
                }
            }
        }
    }

    return visible
}

const isSameTrack = (left: Track | null, right: Track) =>
    left?.id === right.id && left.source === right.source

export function FullscreenPlaylistView({ onBack }: FullscreenPlaylistViewProps) {
    const queue = usePlayerStore(s => s.queue)
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)

    // 背景设置
    const playerBgType = useFullscreenSettingsStore(s => s.playerBgType)
    const customBgPath = useFullscreenSettingsStore(s => s.customBgPath)
    const customBgBlur = useFullscreenSettingsStore(s => s.customBgBlur)
    const customBgBrightness = useFullscreenSettingsStore(s => s.customBgBrightness)
    const customBgScale = useFullscreenSettingsStore(s => s.customBgScale)
    const customBgOverlay = useFullscreenSettingsStore(s => s.customBgOverlay)
    const viewportRef = React.useRef<HTMLDivElement>(null)
    const dragStartRef = React.useRef<CanvasPoint | null>(null)
    const [pan, setPan] = React.useState<CanvasPoint>({ x: 0, y: 0 })
    const [zoom, setZoom] = React.useState(1)
    const [isDragging, setIsDragging] = React.useState(false)
    const [dragged, setDragged] = React.useState(false)
    const [viewportSize, setViewportSize] = React.useState({ width: 1200, height: 800 })

    React.useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return
        const update = () => {
            const rect = viewport.getBoundingClientRect()
            setViewportSize({ width: rect.width, height: rect.height })
        }
        update()
        const observer = new ResizeObserver(update)
        observer.observe(viewport)
        return () => observer.disconnect()
    }, [])

    const visibleCards = React.useMemo(
        () => getVisibleCards(queue, pan, zoom, viewportSize),
        [queue, pan, zoom, viewportSize],
    )

    const resetView = React.useCallback(() => {
        setPan({ x: 0, y: 0 })
        setZoom(1)
    }, [])

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return

        dragStartRef.current = {
            x: event.clientX - pan.x,
            y: event.clientY - pan.y,
        }
        setDragged(false)
        setIsDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }, [pan])

    const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const dragStart = dragStartRef.current
        if (!dragStart) return

        const nextPan = {
            x: event.clientX - dragStart.x,
            y: event.clientY - dragStart.y,
        }
        setDragged(previous => previous || Math.abs(nextPan.x - pan.x) > 4 || Math.abs(nextPan.y - pan.y) > 4)
        setPan(nextPan)
    }, [pan])

    const stopDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return

        dragStartRef.current = null
        setIsDragging(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }, [])

    const handleWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault()
        setPan(prev => ({
            x: prev.x,
            y: prev.y - event.deltaY,
        }))
    }, [])

    const playTrack = React.useCallback((track: Track) => {
        if (!dragged) playerService.playTrack(track)
    }, [dragged])

    return (
        <main className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden bg-black px-7 pb-10 pt-8 text-white lg:px-12 lg:pt-10">
            {/* 动态背景 */}
            <div className="absolute inset-0 z-0 bg-black">
                {playerBgType === 'wallpaper' ? (
                    <WallpaperBackground className="absolute inset-0" />
                ) : playerBgType === 'image' && customBgPath ? (
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
                        fps={30}
                        renderScale={0.2}
                        flowSpeed={0.15}
                        isMobile={false}
                        className="absolute inset-0 w-full h-full opacity-60"
                    />
                )}
                <div
                    className="absolute inset-0 bg-black"
                    style={{
                        opacity: playerBgType === 'image' && customBgPath
                            ? customBgOverlay / 100
                            : playerBgType === 'wallpaper'
                                ? 0.3
                                : 0.45,
                    }}
                />
            </div>
            <header className="relative z-20 mx-auto flex w-full max-w-[1500px] items-end justify-between gap-6 shrink-0 pb-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="group flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors duration-200"
                >
                    <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                    <span className="text-sm">返回</span>
                </button>

                <div className="flex items-baseline gap-3">
                    <h1 className="text-lg font-light tracking-wide text-white/80">播放队列</h1>
                    <span className="text-xs text-white/25 tabular-nums">{queue.length}</span>
                    <button
                        type="button"
                        onClick={resetView}
                        className="ml-2 text-white/20 hover:text-white/50 transition-colors duration-200"
                        title="重置视图"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </header>

            {queue.length > 0 ? (
                <section
                    ref={viewportRef}
                    className={`relative mt-3 flex-1 min-h-0 overflow-hidden ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                    onWheel={handleWheel}
                    onLostPointerCapture={() => {
                        dragStartRef.current = null
                        setIsDragging(false)
                    }}
                >
                    <p className="pointer-events-none absolute left-4 top-4 z-10 text-[10px] text-white/15">拖拽移动 · 滚轮滚动</p>

                    <div
                        className="absolute inset-0 will-change-transform"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: "center",
                            transition: isDragging ? "none" : "transform 200ms ease-out",
                        }}
                    >
                        {visibleCards.map(({ key, track, x, y }) => {
                            const active = isSameTrack(currentTrack, track)
                            const { scale, opacity } = getSphereEffect(x, y, pan, zoom, viewportSize.width, viewportSize.height, active)

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => playTrack(track)}
                                    aria-current={active ? "true" : undefined}
                                    className={`group absolute w-[240px] rounded-2xl p-2.5 text-left outline-none ${isDragging ? "transition-none" : "transition-all duration-300"} focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${active ? "z-10 bg-white/[0.14] shadow-[0_8px_40px_rgba(255,255,255,0.08)]" : "bg-white/[0.04] hover:z-10 hover:bg-white/[0.10]"}`}
                                    style={{
                                        left: `calc(50% + ${x}px - ${CARD_WIDTH / 2}px)`,
                                        top: `calc(50% + ${y}px - ${CARD_HEIGHT / 2}px)`,
                                        transform: `scale(${scale})`,
                                        opacity: opacity,
                                    }}
                                >
                                        <div className="relative aspect-square overflow-hidden rounded-xl bg-white/5">
                                            {track.picUrl ? (
                                                <img
                                                    src={track.picUrl}
                                                    alt={`${track.name} 的专辑封面`}
                                                    draggable={false}
                                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-white/[0.03] text-white/20">
                                                    <Music2 size={32} strokeWidth={1.2} />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
                                            <div className={`absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${active ? "bg-white text-black shadow-lg" : "bg-black/30 text-white/70 opacity-0 backdrop-blur-sm group-hover:opacity-100"}`}>
                                                {active && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                            </div>
                                        </div>

                                        <div className="px-0.5 pb-0.5 pt-3">
                                            <h2 className={`truncate text-[13px] font-medium transition-colors duration-200 ${active ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>
                                                {track.name}
                                            </h2>
                                            <p className="mt-0.5 truncate text-[11px] text-white/25">{track.artists || "未知歌手"}</p>
                                        </div>
                                    </button>
                                )
                            })}
                    </div>
                </section>
            ) : (
                <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <ListMusic size={32} strokeWidth={1.2} className="text-white/15" />
                    <div>
                        <p className="text-sm text-white/30">队列为空</p>
                    </div>
                </section>
            )}
        </main>
    )
}