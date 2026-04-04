"use client"

import { DiscoveryPlaylist } from "@/lib/services/discoveryService"
import { AsyncImage } from "@/components/common/AsyncImage"
import { Play, Headset } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DiscoveryCardProps {
    playlist: DiscoveryPlaylist
    onClick: (id: number) => void
}

export function DiscoveryCard({ playlist, onClick }: DiscoveryCardProps) {
    // 格式化播放量
    const formatPlayCount = (count: number) => {
        if (count >= 100000000) {
            return (count / 100000000).toFixed(1) + "亿"
        }
        if (count >= 10000) {
            return (count / 10000).toFixed(0) + "万"
        }
        return count.toString()
    }

    return (
        <div
            className="group relative space-y-2 sm:space-y-3 cursor-pointer"
            onClick={() => onClick(playlist.id)}
        >
            <div className="relative aspect-square overflow-hidden rounded-xl sm:rounded-2xl shadow-md group-hover:shadow-xl transition-all duration-300">
                <AsyncImage
                    src={playlist.coverImgUrl}
                    alt={playlist.name}
                    imageClassName="transition-all duration-500 group-hover:scale-110"
                />

                {/* 悬浮播放按钮 */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <Button size="icon" className="rounded-full h-10 w-10 sm:h-12 sm:w-12 shadow-lg scale-90 group-hover:scale-100 transition-transform">
                            <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
                        </Button>
                    </div>
                </div>

                {/* 播放量标识 */}
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-1">
                    <Headset className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                    <span className="text-[9px] sm:text-[10px] font-medium text-white">{formatPlayCount(playlist.playCount)}</span>
                </div>
            </div>

            <div className="space-y-0.5 sm:space-y-1 px-0.5 sm:px-1">
                <h3 className="font-bold text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors h-7 sm:h-9">
                    {playlist.name}
                </h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    by {playlist.creatorNickname}
                </p>
            </div>
        </div>
    )
}
