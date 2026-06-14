"use client"

import { UserCircle2, ExternalLink, Link2, Link2Off, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface BindingCardProps {
    platform: "netease" | "kugou" | "qq"
    name: string
    bound: boolean
    nickname?: string
    avatarUrl?: string
    onBind: () => void
    onUnbind: () => void
    isUnbinding?: boolean
}

const platformStyles = {
    netease: {
        gradient: "from-red-500/10 via-rose-500/5 to-transparent dark:from-red-500/20 dark:via-rose-500/10",
        borderGlow: "group-hover:border-rose-500/30",
        shadowGlow: "hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.25)] dark:hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.15)]",
        iconColor: "text-rose-500",
        badgeBg: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
        buttonBg: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md shadow-rose-500/20",
    },
    kugou: {
        gradient: "from-blue-500/10 via-cyan-500/5 to-transparent dark:from-blue-500/20 dark:via-cyan-500/10",
        borderGlow: "group-hover:border-cyan-500/30",
        shadowGlow: "hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.25)] dark:hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]",
        iconColor: "text-cyan-500",
        badgeBg: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
        buttonBg: "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md shadow-cyan-500/20",
    },
    qq: {
        gradient: "from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10",
        borderGlow: "group-hover:border-emerald-500/30",
        shadowGlow: "hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.25)] dark:hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]",
        iconColor: "text-emerald-500",
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
        buttonBg: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20",
    }
}

export function BindingCard({
    platform,
    name,
    bound,
    nickname,
    avatarUrl,
    onBind,
    onUnbind,
    isUnbinding = false
}: BindingCardProps) {
    const style = platformStyles[platform];

    return (
        <Card className={`group relative overflow-hidden transition-all duration-500 ease-out 
            backdrop-blur-xl bg-white/40 dark:bg-black/40 
            border-white/20 dark:border-white/10 
            hover:-translate-y-1 ${style.shadowGlow} ${style.borderGlow}`}>
            
            {/* Dynamic Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-50 transition-opacity group-hover:opacity-100 pointer-events-none`} />

            <CardContent className="relative z-10 p-5 sm:p-6 flex flex-col h-full min-h-[180px]">
                {/* Header: Avatar and Badge */}
                <div className="flex items-start justify-between">
                    <div className="relative">
                        <Avatar className={`h-12 w-12 sm:h-14 sm:w-14 border-2 shadow-sm transition-transform duration-300 group-hover:scale-105 ${bound ? 'border-transparent' : 'border-background'}`}>
                            <AvatarImage src={avatarUrl} alt={nickname || name} className="object-cover" />
                            <AvatarFallback className="bg-background/50 backdrop-blur-sm">
                                {nickname ? nickname[0] : <UserCircle2 className={`h-6 w-6 ${style.iconColor}`} />}
                            </AvatarFallback>
                        </Avatar>
                        {bound && (
                            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-background shadow-sm animate-in zoom-in duration-300">
                                <CheckIcon className="h-2.5 w-2.5 text-white" />
                            </div>
                        )}
                    </div>
                    
                    {bound ? (
                        <Badge variant="secondary" className={`${style.badgeBg} border-none h-6 px-2.5 text-xs font-bold shadow-sm backdrop-blur-md`}>
                            已绑定
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground/70 border-muted-foreground/20 h-6 px-2.5 text-xs font-medium backdrop-blur-sm bg-background/30">
                            未绑定
                        </Badge>
                    )}
                </div>

                {/* Body: Texts */}
                <div className="mt-4 flex flex-col gap-1">
                    <h4 className="font-bold text-base sm:text-lg tracking-tight dark:text-zinc-100">{name}</h4>
                    <p className="text-sm text-muted-foreground/80 line-clamp-1">
                        {bound ? nickname : `绑定账户以同步歌单和收藏`}
                    </p>
                </div>

                {/* Footer: Button */}
                <div className="mt-auto pt-6">
                    {bound ? (
                        <Button
                            variant="outline"
                            onClick={onUnbind}
                            disabled={isUnbinding}
                            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 h-10 bg-background/50 backdrop-blur-md transition-all font-medium"
                        >
                            {isUnbinding ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Link2Off className="h-4 w-4 mr-2 opacity-70" />
                                    解除绑定
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={onBind}
                            className={`w-full h-10 font-medium transition-all duration-300 ${style.buttonBg} border-0`}
                        >
                            <Link2 className="h-4 w-4 mr-2 opacity-90" />
                            立即绑定
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function CheckIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    )
}
