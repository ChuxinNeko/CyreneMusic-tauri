"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronRight, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { AsyncImage } from "@/components/common/AsyncImage"
import { PosterDialog } from "./PosterDialog"
import { useAuthStore } from "@/lib/store/useAuthStore"

interface WeeklyAlbumWallProps {
    weeklyPlays: any[] | null
    loading?: boolean
}

export function WeeklyAlbumWall({ weeklyPlays, loading }: WeeklyAlbumWallProps) {
    const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
    const [isLandscape, setIsLandscape] = useState(false)
    const [isPosterOpen, setIsPosterOpen] = useState(false)
    const { user } = useAuthStore()

    const handleImageError = (index: number) => {
        setImageErrors(prev => new Set(prev).add(index))
    }

    // 检测横屏模式
    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.matchMedia("(orientation: landscape)").matches)
        }
        
        checkOrientation()
        window.addEventListener("resize", checkOrientation)
        window.addEventListener("orientationchange", checkOrientation)
        
        return () => {
            window.removeEventListener("resize", checkOrientation)
            window.removeEventListener("orientationchange", checkOrientation)
        }
    }, [])

    // 取前20首歌曲的封面，不足则用占位符
    const albumCovers = weeklyPlays?.slice(0, 20) || []
    const displayCount = weeklyPlays?.length || 0

    // 生成占位图颜色（用于没有封面的情况）
    const getPlaceholderColor = (index: number) => {
        const colors = [
            "bg-gradient-to-br from-violet-500 to-purple-600",
            "bg-gradient-to-br from-blue-500 to-cyan-500",
            "bg-gradient-to-br from-emerald-500 to-teal-500",
            "bg-gradient-to-br from-orange-500 to-red-500",
            "bg-gradient-to-br from-pink-500 to-rose-500",
            "bg-gradient-to-br from-amber-500 to-yellow-500",
            "bg-gradient-to-br from-indigo-500 to-blue-600",
            "bg-gradient-to-br from-fuchsia-500 to-purple-500"
        ]
        return colors[index % colors.length]
    }

    const gridCols = isLandscape ? 5 : 4
    const gridRows = isLandscape ? 4 : 5
    const coversPerGrid = gridCols * gridRows

    // 生成一个网格所需的封面序列，通过循环填充
    const getGridCovers = useCallback(() => {
        const result: typeof albumCovers = []
        for (let i = 0; i < coversPerGrid; i++) {
            result.push(albumCovers[i % albumCovers.length])
        }
        return result
    }, [albumCovers, coversPerGrid])

    if (loading) {
        return (
            <div className="w-full aspect-[4/5] rounded-[1.8rem] bg-card/30 backdrop-blur-md border border-border/40 ring-1 ring-white/5 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!weeklyPlays || weeklyPlays.length === 0) {
        return (
            <div className="w-full aspect-[4/5] rounded-[1.8rem] bg-card/30 backdrop-blur-md border border-border/40 ring-1 ring-white/5 flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">暂无本周播放记录</h3>
                <p className="text-sm text-muted-foreground">多听几首歌后再来看看吧</p>
            </div>
        )
    }

    const gridCovers = getGridCovers()

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full max-w-[420px] mx-auto flex flex-col space-y-4"
        >
            {/* 唱片墙卡片 */}
            <div className={`flex-1 group relative w-full h-full aspect-[4/5] lg:aspect-auto rounded-[1.8rem] overflow-hidden shadow-lg bg-gray-200 dark:bg-gray-800 ${isLandscape ? 'album-wall-landscape' : ''}`}>
                {/* 唱片网格容器 */}
                <div className="relative w-full h-full overflow-hidden">
                    {/* 滚动内容 */}
                    <div 
                        className={isLandscape ? 'album-wall-scroll-horizontal' : 'album-wall-scroll-vertical'}
                        style={isLandscape ? { 
                            display: 'flex', 
                            width: '200%', 
                            height: '100%',
                            position: 'absolute',
                            top: 0,
                            left: 0
                        } : { 
                            display: 'flex', 
                            flexDirection: 'column',
                            width: '100%', 
                            position: 'absolute',
                            top: 0,
                            left: 0
                        }}
                    >
                        {/* 两个相同的网格交替播放实现无缝滚动 */}
                        {[0, 1].map((repeatIndex) => (
                            <div
                                key={repeatIndex}
                                className="grid"
                                style={{
                                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                                    width: isLandscape ? '50%' : '100%',
                                    height: isLandscape ? '100%' : 'auto'
                                }}
                            >
                                {gridCovers.map((song, index) => {
                                    const hasError = imageErrors.has(index)
                                    const hasCover = song?.pic_url && !hasError

                                    return (
                                        <div key={`${repeatIndex}-${index}`} className="relative w-full aspect-square overflow-hidden">
                                            {hasCover ? (
                                                <img
                                                    src={song.pic_url}
                                                    alt={song.track_name || "Album"}
                                                    className="w-full h-full object-cover"
                                                    onError={() => handleImageError(index)}
                                                />
                                            ) : (
                                                <div className={`w-full h-full ${getPlaceholderColor(index)}`} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 左上角标题 */}
                <div className="absolute top-7 left-6 z-10">
                    <h1 className="text-white text-2xl sm:text-[32px] font-bold tracking-widest text-glow">
                        本周唱片墙
                    </h1>
                </div>

                {/* 右下角数据统计及黑色渐变遮罩 */}
                <div className="absolute bottom-0 left-0 w-full h-[55%] bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10 flex flex-col justify-end items-end p-6 pb-5">
                    {/* 收听数量 */}
                    <div className="flex items-baseline text-white text-glow mb-1">
                        <span className="text-5xl sm:text-[76px] font-bold leading-none tracking-tighter">
                            {displayCount}
                        </span>
                        <span className="text-xl sm:text-[26px] font-medium ml-1">首</span>
                    </div>

                    {/* 链接 */}
                    <div className="flex items-center text-white/95 text-glow-sm cursor-pointer pointer-events-auto hover:text-white transition-colors">
                        <span className="text-sm sm:text-[15px] font-medium">本周收听歌曲</span>
                        <ChevronRight className="w-4 h-4 ml-0.5 opacity-90" />
                    </div>
                </div>

                {/* 悬浮操作按钮 */}
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                    <button 
                        onClick={() => setIsPosterOpen(true)}
                        className="w-[160px] bg-primary text-primary-foreground py-3.5 rounded-full font-bold text-[17px] shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150"
                    >
                        生成海报
                    </button>
                    <button className="w-[160px] bg-secondary text-secondary-foreground py-3.5 rounded-full font-bold text-[17px] shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150">
                        生成壁纸
                    </button>
                </div>
            </div>
            
            {/* 隐藏的占位高度，用于在大屏下与右侧语言统计组件的底部文字高度完美对齐 */}
            <div className="hidden lg:block h-[20px]" />

            <PosterDialog 
                isOpen={isPosterOpen} 
                onClose={() => setIsPosterOpen(false)} 
                weeklyPlays={weeklyPlays}
                user={user}
            />
        </motion.div>
    )
}