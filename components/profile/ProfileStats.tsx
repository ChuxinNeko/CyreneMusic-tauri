import { Timer, Activity, Play, Headphones } from "lucide-react"

interface ProfileStatsProps {
    stats: any
}

export function ProfileStats({ stats }: ProfileStatsProps) {
    const formatListeningTime = (seconds: number) => {
        if (!seconds) return '0分钟'
        if (seconds < 60) return `${seconds}秒`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        return `${hours}小时 ${mins}分钟`
    }

    return (
        <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex flex-col p-5 rounded-3xl bg-card/30 hover:bg-card/50 backdrop-blur-md border border-border/40 transition-all group ring-1 ring-white/5">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                    <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Headphones className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">聆听时长</span>
                </div>
                <div className="text-2xl md:text-3xl font-black tracking-tight">
                    {formatListeningTime(stats?.totalListeningTime || 0)}
                </div>
            </div>
            
            <div className="flex flex-col p-5 rounded-3xl bg-card/30 hover:bg-card/50 backdrop-blur-md border border-border/40 transition-all group ring-1 ring-white/5">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                    <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Play className="w-4 h-4 text-primary fill-primary/20" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">播放次数</span>
                </div>
                <div className="text-2xl md:text-3xl font-black tracking-tight">
                    {stats?.totalPlayCount || 0} <span className="text-lg font-bold text-muted-foreground/50">次</span>
                </div>
            </div>
        </div>
    )
}
