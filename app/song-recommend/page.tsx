"use client"

import { useEffect, useState } from "react"
import { X, Play, Sparkles, Loader2 } from "lucide-react"
import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import { Track } from "@/lib/models/track"
import { playerService } from "@/lib/services/playerService"
import { emit } from "@tauri-apps/api/event"
import { toast } from "sonner"

interface RecommendPayload {
    tracks: Track[]
    coverUrl: string
}

export default function SongRecommendPage() {
    const [tracks, setTracks] = useState<Track[]>([])
    const [coverUrl, setCoverUrl] = useState("")
    const [loaded, setLoaded] = useState(false)
    const [coverLoaded, setCoverLoaded] = useState(false)

    useEffect(() => {
        // 监听从主窗口发来的推荐数据
        const unlistenData = listen<RecommendPayload>("recommend:data", (event) => {
            const { tracks: newTracks, coverUrl: newCover } = event.payload
            setTracks(newTracks)
            setCoverUrl(newCover)
            setLoaded(true)
        })

        // 请求主窗口发送数据
        emit("recommend:request-data")

        // 失焦时不关闭，因为这只是个推荐展示窗口

        // 禁用右键菜单
        const handleContextMenu = (e: MouseEvent) => e.preventDefault()
        document.addEventListener("contextmenu", handleContextMenu)

        return () => {
            unlistenData.then(f => f())
            document.removeEventListener("contextmenu", handleContextMenu)
        }
    }, [])

    const handlePlayTrack = (track: Track) => {
        // 通过事件通知主窗口播放
        emit("recommend:play", { track, queue: tracks })
    }

    const handleClose = async () => {
        try {
            await invoke("close_recommend_popup")
        } catch {
            // 忽略错误
        }
    }

    return (
        <div className="h-screen w-full bg-background/95 backdrop-blur-xl overflow-hidden flex flex-col select-none rounded-2xl border border-border/40 shadow-2xl">
            <style global jsx>{`
                body {
                    user-select: none;
                    overflow: hidden;
                    background: transparent;
                    margin: 0;
                    padding: 0;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>

            {/* 封面区域 (可拖拽) */}
            <div data-tauri-drag-region className="relative h-[160px] w-full shrink-0">
                {coverUrl && (
                    <img
                        src={coverUrl}
                        alt=""
                        className={`h-full w-full object-cover pointer-events-none transition-opacity duration-700 ${coverLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setCoverLoaded(true)}
                    />
                )}
                {/* 未加载时的占位 */}
                {!coverLoaded && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-primary/40 animate-pulse" />
                    </div>
                )}
                {/* 渐变遮罩：从底部向上渐变到透明，融合背景 */}
                <div data-tauri-drag-region className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />
                {/* 顶部轻微暗角，让关闭按钮更清晰 */}
                <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
                
                {/* 关闭按钮 */}
                <button
                    onClick={handleClose}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/50 backdrop-blur-md text-white/80 hover:text-white transition-all duration-300 z-10"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* 标题区域 (可拖拽) */}
            <div data-tauri-drag-region className="px-5 pt-2 pb-3 shrink-0">
                <div className="flex items-center gap-2 pointer-events-none">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground tracking-wide">今日推荐</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 pointer-events-none">为你精选的几首歌曲</p>
            </div>

            {/* 歌曲列表 */}
            <div className="flex-1 overflow-auto px-2 pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {!loaded ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                    </div>
                ) : tracks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        暂无推荐歌曲
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {tracks.map((track, index) => (
                            <div
                                key={`${track.id}-${track.source}`}
                                onClick={() => handlePlayTrack(track)}
                                className="group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-accent/40 transition-all duration-300"
                            >
                                {/* 序号 / 播放图标 */}
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                    <span className="text-xs text-muted-foreground font-medium group-hover:hidden">
                                        {index + 1}
                                    </span>
                                    <Play className="h-4 w-4 text-primary fill-primary hidden group-hover:block transition-transform active:scale-90" />
                                </div>

                                {/* 小封面 */}
                                <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 shadow-sm bg-muted/50 border border-border/20">
                                    <img
                                        src={track.picUrl}
                                        alt={track.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>

                                {/* 歌曲信息 */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors duration-200">
                                        {track.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {track.artists}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
