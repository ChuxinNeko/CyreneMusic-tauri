import { Trophy } from "lucide-react"
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 bg-accent/5 p-6 rounded-3xl border border-accent/10">
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
                            className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/10 transition-all cursor-pointer border border-transparent hover:border-border/50"
                        >
                            <div className="relative shrink-0">
                                <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted shadow-sm ring-1 ring-border/50">
                                    <AsyncImage src={item.pic_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                </div>
                                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-extrabold text-primary-foreground shadow-sm ring-2 ring-background">
                                    {index + 1}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[13px] font-bold truncate group-hover:text-primary transition-colors leading-tight">
                                    {item.track_name}
                                </h4>
                                <div className="flex items-center justify-between mt-0.5">
                                    <p className="text-[11px] font-medium text-muted-foreground truncate max-w-[150px]">
                                        {item.artists}
                                    </p>
                                    <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-bold bg-primary/5 text-primary hover:bg-primary/10 transition-colors pointer-events-none">
                                        {item.play_count}次
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="col-span-full text-xs text-center py-10 text-muted-foreground font-medium">
                        听几首歌后再来吧
                    </p>
                )}
            </div>
        </div>
    )
}
