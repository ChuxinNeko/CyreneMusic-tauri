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
            className="group relative space-y-3 cursor-pointer"
            onClick={() => onClick(playlist.id)}
        >
            <div className="relative aspect-square overflow-hidden rounded-2xl shadow-md group-hover:shadow-xl transition-all duration-300">
                <AsyncImage
                    src={playlist.coverImgUrl}
                    alt={playlist.name}
                    imageClassName="transition-all duration-500 group-hover:scale-110"
                />

                {/* 悬浮播放按钮 */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <Button size="icon" className="rounded-full h-12 w-12 shadow-lg scale-90 group-hover:scale-100 transition-transform">
                            <Play className="h-6 w-6 fill-current" />
                        </Button>
                    </div>
                </div>

                {/* 播放量标识 */}
                <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-1">
                    <Headset className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-medium text-white">{formatPlayCount(playlist.playCount)}</span>
                </div>
            </div>

            <div className="space-y-1 px-1">
                <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors h-9">
                    {playlist.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                    by {playlist.creatorNickname}
                </p>
            </div>
        </div>
    )
}
