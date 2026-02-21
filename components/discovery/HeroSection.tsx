"use client"

import { Play, SkipForward, Radio, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AsyncImage } from "@/components/common/AsyncImage"

interface HeroSectionProps {
    dailySongs: any[]
    fmSongs: any[]
    onDailyClick?: () => void
    onPlayDaily?: () => void
    onPlayFm?: () => void
    onNextFm?: () => void
}

export function HeroSection({
    dailySongs,
    fmSongs,
    onDailyClick,
    onPlayDaily,
    onPlayFm,
    onNextFm
}: HeroSectionProps) {
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // Get up to 6 covers for the collage
    const collageCovers = dailySongs.slice(0, 6).map(s => s.picUrl || s.al?.picUrl || s.album?.picUrl).filter(Boolean)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
            {/* Daily Recommend Card */}
            <Card
                onClick={onDailyClick}
                className="lg:col-span-3 h-[240px] relative overflow-hidden group cursor-pointer border-none shadow-xl transition-all duration-500 hover:shadow-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/5"
            >
                {/* Right Side Collage (Background) */}
                <div className="absolute right-[-20px] top-[-20px] bottom-[-20px] w-[280px] hidden sm:block pointer-events-none transition-transform duration-700 group-hover:scale-105">
                    <div className="w-full h-full rotate-[5.7deg] opacity-40">
                        <div className="grid grid-cols-2 gap-1.5 w-full h-full">
                            {collageCovers.map((url, i) => (
                                <div key={i} className="relative rounded-lg overflow-hidden shadow-sm">
                                    <AsyncImage src={url} className="w-full h-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Gradient Mask to Blend Collage */}
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent pointer-events-none" />

                {/* Content Overlay */}
                <div className="relative h-full p-8 flex flex-col items-start justify-between z-10 w-full sm:w-[60%]">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold shadow-lg w-fit">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {month}月{day}日
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black">每日推荐</h3>
                            <p className="text-sm text-muted-foreground">
                                精选您的私人订制旋律
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            size="icon"
                            className="h-12 w-12 rounded-full shadow-lg group-hover:scale-110 transition-transform"
                            onClick={(e) => {
                                e.stopPropagation()
                                onPlayDaily?.()
                            }}
                        >
                            <Play className="h-6 w-6 fill-current" />
                        </Button>
                        <span className="text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0 duration-300">
                            立即播放
                        </span>
                    </div>
                </div>
            </Card>

            {/* Personal FM Card */}
            <Card className="lg:col-span-2 h-[240px] relative overflow-hidden border-none shadow-xl bg-accent/10 transition-all duration-500 hover:bg-accent/20">
                {/* Inner Content */}
                <div className="relative h-full p-6 flex flex-col justify-between z-10">
                    <div className="flex items-center gap-2 text-primary">
                        <Radio className="h-5 w-5 animate-pulse" />
                        <span className="text-sm font-bold tracking-widest uppercase">私人 FM</span>
                    </div>

                    {fmSongs.length > 0 ? (
                        <div className="flex items-center gap-4">
                            <div
                                className="h-24 w-24 rounded-2xl overflow-hidden shadow-2xl relative group/fm cursor-pointer"
                                onClick={onPlayFm}
                            >
                                <AsyncImage src={fmSongs[0].picUrl || fmSongs[0].al?.picUrl || fmSongs[0].album?.picUrl} className="h-full w-full" imageClassName="transition-transform duration-700 group-hover/fm:scale-110" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/fm:opacity-100 transition-opacity">
                                    <Play className="h-8 w-8 text-white fill-white" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <h4 className="font-bold text-lg truncate">{fmSongs[0].name}</h4>
                                <p className="text-sm text-muted-foreground truncate">
                                    {fmSongs[0].artists?.map((a: any) => a.name).join("/") || "歌手未知"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-24">
                            <p className="text-xs text-muted-foreground">FM 内容由于加载中...</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="rounded-xl border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors h-10 gap-2 font-bold"
                            onClick={onPlayFm}
                        >
                            <Play className="h-4 w-4 fill-current" />
                            播放
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-xl border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors h-10 gap-2 font-bold"
                            onClick={onNextFm}
                        >
                            <SkipForward className="h-4 w-4" />
                            下一首
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
