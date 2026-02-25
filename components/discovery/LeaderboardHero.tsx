"use client"

import { Play, Trophy, Shuffle, Music2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AsyncImage } from "@/components/common/AsyncImage"
import { playerService } from "@/lib/services/playerService"
import { discoveryService } from "@/lib/services/discoveryService"
import { Track } from "@/lib/models/track"

interface LeaderboardHeroProps {
    randomTracks: any[]
    onPlayAll?: () => void
}

export function LeaderboardHero({
    randomTracks,
    onPlayAll
}: LeaderboardHeroProps) {
    if (randomTracks.length === 0) return null

    // Get up to 6 covers for the collage
    const collageCovers = randomTracks.slice(0, 6).map(t => t.picUrl).filter(Boolean)

    const handlePlayTrack = (track: any) => {
        const trackObj = discoveryService.convertToTrack(track)
        playerService.playWithQueue(trackObj, [trackObj])
    }

    return (
        <Card className="h-[280px] relative overflow-hidden group border-none shadow-2xl transition-all duration-500 hover:shadow-primary/20 bg-gradient-to-br from-primary/20 via-background to-accent/10 mb-12">
            {/* Right Side Collage (Background) */}
            <div className="absolute right-[-40px] top-[-40px] bottom-[-40px] w-[320px] hidden sm:block pointer-events-none transition-transform duration-1000 group-hover:scale-110 group-hover:rotate-2">
                <div className="w-full h-full rotate-[12deg] opacity-30">
                    <div className="grid grid-cols-2 gap-2 w-full h-full">
                        {collageCovers.map((url, i) => (
                            <div key={i} className="relative rounded-xl overflow-hidden shadow-2xl border border-white/10">
                                <AsyncImage src={url} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Gradient Mask */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" />

            {/* Content Overlay */}
            <div className="relative h-full px-10 py-8 flex flex-col justify-center gap-8 z-10 w-full sm:w-[65%]">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-black shadow-[0_0_20px_rgba(var(--primary),0.4)] w-fit animate-bounce-slow">
                        <Trophy className="h-4 w-4" />
                        今日榜单精选
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-4xl font-black tracking-tighter lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                            发现热门旋律
                        </h3>
                        <p className="text-muted-foreground text-sm font-medium max-w-md line-clamp-2">
                            从全部榜单中为您随机抽选。{randomTracks.length > 0 && `当前精选：${randomTracks[0].name} - ${randomTracks[0].artists}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        size="lg"
                        className="rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/40 transition-all group/play flex gap-3 font-bold text-base"
                        onClick={onPlayAll}
                    >
                        <Shuffle className="h-4 w-4 fill-current" />
                        随机播放榜单
                    </Button>

                    <div className="flex -space-x-3 hover:space-x-1 transition-all duration-500">
                        {randomTracks.slice(0, 3).map((track, i) => (
                            <div
                                key={track.id}
                                className="h-10 w-10 rounded-full border-2 border-background overflow-hidden cursor-pointer shadow-lg hover:z-10 hover:scale-110 transition-all"
                                title={track.name}
                                onClick={() => handlePlayTrack(track)}
                            >
                                <AsyncImage src={track.picUrl} className="h-full w-full object-cover" />
                            </div>
                        ))}
                        {randomTracks.length > 3 && (
                            <div className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold shadow-lg">
                                +{randomTracks.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Animated background element */}
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-pulse" />
        </Card>
    )
}
