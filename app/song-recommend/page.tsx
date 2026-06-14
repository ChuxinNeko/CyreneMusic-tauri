"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { X, Play, Sparkles, Loader2 } from "lucide-react"
import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import { Track } from "@/lib/models/track"
import { playerService } from "@/lib/services/playerService"
import { emit } from "@tauri-apps/api/event"
import { toast } from "sonner"
import { FastAverageColor } from "fast-average-color"

interface RecommendPayload {
    tracks: Track[]
    coverUrl: string
}

export default function SongRecommendPage() {
    const [tracks, setTracks] = useState<Track[]>([])
    const [coverUrl, setCoverUrl] = useState("")
    const [loaded, setLoaded] = useState(false)
    const [coverLoaded, setCoverLoaded] = useState(false)
    // 从封面提取的主题色 [r,g,b]，取色失败时为 null（回退到默认背景色）
    const [themeRgb, setThemeRgb] = useState<[number, number, number] | null>(null)
    const [coverIsDark, setCoverIsDark] = useState(true)

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

    // 从封面提取主题色（用于向下渐变与卡片背景）
    useEffect(() => {
        if (!coverUrl) return
        const fac = new FastAverageColor()
        let cancelled = false
        fac.getColorAsync(coverUrl, { crossOrigin: "anonymous" })
            .then((color) => {
                if (cancelled) return
                // 跨域污染等取色失败时 FAC 不会 reject，而是返回带 error 的默认色，此时保持 null 回退默认背景
                if (color.error) {
                    console.error("[SongRecommend] 封面取色失败:", color.error)
                    return
                }
                const [r, g, b] = color.value
                setThemeRgb([r, g, b])
                setCoverIsDark(color.isDark)
            })
            .catch((e) => {
                console.error("[SongRecommend] 封面取色失败:", e)
            })
        return () => {
            cancelled = true
            fac.destroy()
        }
    }, [coverUrl])

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

    // 主题色与基于其明暗的自适应文字/边框样式
    const hasTheme = themeRgb !== null
    const [tr, tg, tb] = themeRgb ?? [255, 255, 255]
    const fg = coverIsDark ? "text-white" : "text-zinc-900"
    const fgSub = coverIsDark ? "text-white/65" : "text-zinc-900/60"
    const hoverBg = coverIsDark ? "hover:bg-white/10" : "hover:bg-black/10"
    const borderColor = coverIsDark ? "border-white/15" : "border-black/10"
    // 自定义滚动条颜色（随主题明暗自适应；无主题时用中性灰）
    const scrollVars = {
        "--rec-scroll-thumb": !hasTheme
            ? "rgba(120, 120, 120, 0.30)"
            : coverIsDark ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 0, 0, 0.22)",
        "--rec-scroll-thumb-hover": !hasTheme
            ? "rgba(120, 120, 120, 0.55)"
            : coverIsDark ? "rgba(255, 255, 255, 0.50)" : "rgba(0, 0, 0, 0.40)",
    } as CSSProperties

    return (
        <div
            className={`h-screen w-full backdrop-blur-xl overflow-hidden flex flex-col select-none border shadow-2xl ${hasTheme ? borderColor : "bg-background/95 border-border/40"}`}
            style={hasTheme ? { backgroundColor: `rgb(${tr}, ${tg}, ${tb})` } : undefined}
        >
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
                /* 自定义滚动条（替换浏览器默认样式） */
                .recommend-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: var(--rec-scroll-thumb, rgba(120, 120, 120, 0.3)) transparent;
                }
                .recommend-scroll::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .recommend-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .recommend-scroll::-webkit-scrollbar-thumb {
                    background-color: var(--rec-scroll-thumb, rgba(120, 120, 120, 0.3));
                    border-radius: 9999px;
                }
                .recommend-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: var(--rec-scroll-thumb-hover, rgba(120, 120, 120, 0.55));
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
                {/* 渐变遮罩：封面向下渐变到封面主题色（取色失败时回退到背景色） */}
                <div
                    data-tauri-drag-region
                    className={`absolute inset-0 pointer-events-none ${hasTheme ? '' : 'bg-gradient-to-t from-background via-background/20 to-transparent'}`}
                    style={hasTheme ? {
                        background: `linear-gradient(to top, rgb(${tr}, ${tg}, ${tb}) 0%, rgba(${tr}, ${tg}, ${tb}, 0.55) 35%, rgba(${tr}, ${tg}, ${tb}, 0) 100%)`,
                    } : undefined}
                />
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
                    <Sparkles className={`h-4 w-4 ${hasTheme ? fg : 'text-primary'}`} />
                    <h3 className={`text-sm font-bold tracking-wide ${hasTheme ? fg : 'text-foreground'}`}>今日推荐</h3>
                </div>
                <p className={`text-xs mt-1 pointer-events-none ${hasTheme ? fgSub : 'text-muted-foreground'}`}>为你精选的几首歌曲</p>
            </div>

            {/* 歌曲列表 */}
            <div className="recommend-scroll flex-1 overflow-auto px-2 pb-2" style={scrollVars}>
                {!loaded ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className={`h-6 w-6 animate-spin ${hasTheme ? fgSub : 'text-muted-foreground/50'}`} />
                    </div>
                ) : tracks.length === 0 ? (
                    <div className={`flex items-center justify-center h-full text-sm ${hasTheme ? fgSub : 'text-muted-foreground'}`}>
                        暂无推荐歌曲
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {tracks.map((track, index) => (
                            <div
                                key={`${track.id}-${track.source}`}
                                onClick={() => handlePlayTrack(track)}
                                className={`group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-300 ${hasTheme ? hoverBg : 'hover:bg-accent/40'}`}
                            >
                                {/* 序号 / 播放图标 */}
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                    <span className={`text-xs font-medium group-hover:hidden ${hasTheme ? fgSub : 'text-muted-foreground'}`}>
                                        {index + 1}
                                    </span>
                                    <Play className={`h-4 w-4 hidden group-hover:block transition-transform active:scale-90 ${hasTheme ? `${fg} fill-current` : 'text-primary fill-primary'}`} />
                                </div>

                                {/* 小封面 */}
                                <div className={`w-10 h-10 rounded-md overflow-hidden shrink-0 shadow-sm border ${hasTheme ? `bg-black/10 ${borderColor}` : 'bg-muted/50 border-border/20'}`}>
                                    <img
                                        src={track.picUrl}
                                        alt={track.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>

                                {/* 歌曲信息 */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate transition-colors duration-200 ${hasTheme ? fg : 'text-foreground group-hover:text-primary'}`}>
                                        {track.name}
                                    </p>
                                    <p className={`text-xs truncate mt-0.5 ${hasTheme ? fgSub : 'text-muted-foreground'}`}>
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
