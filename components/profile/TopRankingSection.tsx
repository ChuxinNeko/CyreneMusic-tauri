import { Trophy, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AsyncImage } from "@/components/common/AsyncImage"
import { Track } from "@/lib/models/track"
import { playerService } from "@/lib/services/playerService"

interface TopRankingSectionProps {
    topPlays: any[]
}

export function TopRankingSection({ topPlays }: TopRankingSectionProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 px-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-2xl font-black tracking-tight">播放排行</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {topPlays.length > 0 ? (
                    topPlays.map((item: any, index: number) => (
                        <div
                            key={`${item.track_id}-${index}`}
                            onClick={() => {
                                const track: Track = {
                                    id: item.track_id,
                                    name: item.track_name,
                                    artists: item.artists,
                                    album: item.album || '',
                                    picUrl: item.pic_url,
                                    source: item.source,
                                    duration: 0
                                }
                                playerService.playWithQueue(track, [track])
                            }}
                            className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-accent/10 transition-all cursor-pointer border border-transparent hover:border-border/50"
                        >
                            <div className="w-6 text-center text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors tabular-nums">
                                {index + 1}
                            </div>
                            <div className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-muted shadow-sm ring-1 ring-border/50">
                                <AsyncImage src={item.pic_url} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                                    <Play className="w-6 h-6 text-white fill-white ml-0.5 shadow-sm" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="text-[15px] font-bold truncate text-foreground group-hover:text-primary transition-colors leading-tight">
                                    {item.track_name}
                                </h4>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-[12px] font-medium text-muted-foreground truncate max-w-[160px]">
                                        {item.artists}
                                    </p>
                                    <div className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">
                                        {item.play_count}次
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-16 text-center bg-accent/5 rounded-[2rem] border-2 border-dashed border-accent/50 flex flex-col items-center justify-center">
                        <Trophy className="w-12 h-12 text-muted-foreground/20 mb-4" />
                        <h3 className="text-lg font-bold text-foreground mb-1">暂无播放记录</h3>
                        <p className="text-sm text-muted-foreground">多听几首歌后再来看看吧</p>
                    </div>
                )}
            </div>
        </div>
    )
}
