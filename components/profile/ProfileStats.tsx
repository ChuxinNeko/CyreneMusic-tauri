import { Timer, Activity, Clock3, Play } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProfileStatsProps {
    stats: any
}

export function ProfileStats({ stats }: ProfileStatsProps) {
    const formatListeningTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}秒`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        return `${hours}小时 ${mins}分钟`
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
            <Card className="border border-border/40 bg-card/50 backdrop-blur-sm hover:bg-accent/10 transition-all shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">聆听时长</CardTitle>
                    <Timer className="w-4 h-4 text-primary opacity-80" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black tracking-tighter">
                        {formatListeningTime(stats?.totalListeningTime || 0)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        伴你度过的每一个旋律时刻
                    </p>
                </CardContent>
            </Card>
            <Card className="border border-border/40 bg-card/50 backdrop-blur-sm hover:bg-accent/10 transition-all shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">播放次数</CardTitle>
                    <Activity className="w-4 h-4 text-primary opacity-80" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black tracking-tighter">
                        {stats?.totalPlayCount || 0} <span className="text-base font-bold text-muted-foreground/50">次</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Play className="w-3 h-3 fill-current" />
                        开启音乐旅程的总频率
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
