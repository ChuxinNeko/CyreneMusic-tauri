"use client"

import { useEffect, useState } from "react"
import { sponsorService, Sponsor } from "@/lib/services/sponsorService"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Heart, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SponsorWall() {
    const [sponsors, setSponsors] = useState<Sponsor[]>([])
    const [loading, setLoading] = useState(true)
    const [enabled, setEnabled] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadSponsors = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await sponsorService.getSponsorList()
            if (result.code === 200 && result.data) {
                setEnabled(result.data.enabled)
                setSponsors(result.data.sponsors)
            } else {
                setError(result.message || "加载失败")
            }
        } catch {
            setError("加载失败")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSponsors()
    }, [])

    // 后端禁用赞助墙则隐藏
    if (!loading && !enabled) return null

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return ""
        try {
            const date = new Date(dateStr)
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        } catch {
            return ""
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-semibold tracking-tight">赞助墙</h2>
                    <span className="text-sm text-muted-foreground">
                        感谢以下用户的支持
                    </span>
                </div>
                {!loading && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={loadSponsors}
                    >
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </Button>
                )}
            </div>

            <div className="rounded-xl border bg-card p-6">
                {loading && (
                    <div className="flex flex-wrap gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 w-20">
                                <Skeleton className="h-14 w-14 rounded-full" />
                                <Skeleton className="h-3 w-14 rounded" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && error && (
                    <div className="flex flex-col items-center py-8 gap-3">
                        <div className="text-destructive text-sm">{error}</div>
                        <Button variant="outline" size="sm" onClick={loadSponsors}>
                            重试
                        </Button>
                    </div>
                )}

                {!loading && !error && sponsors.length === 0 && (
                    <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
                        <Heart className="h-10 w-10 opacity-30" />
                        <span className="text-sm">暂无赞助用户，成为第一位支持者吧！</span>
                    </div>
                )}

                {!loading && !error && sponsors.length > 0 && (
                    <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap gap-5">
                            {sponsors.map((sponsor) => {
                                const dateStr = formatDate(sponsor.sponsorSince)
                                return (
                                    <Tooltip key={sponsor.id}>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-col items-center gap-2 w-20 group cursor-default">
                                                <Avatar className="h-14 w-14 border-2 border-amber-400/40 shadow-sm transition-transform group-hover:scale-110">
                                                    <AvatarImage
                                                        src={sponsor.avatarUrl || undefined}
                                                        alt={sponsor.username}
                                                    />
                                                    <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-lg">
                                                        {sponsor.username.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs font-medium text-center truncate w-full">
                                                    {sponsor.username}
                                                </span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-medium">{sponsor.username}</p>
                                            {dateStr && (
                                                <p className="text-xs text-muted-foreground">
                                                    赞助于 {dateStr}
                                                </p>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                )
                            })}
                        </div>
                    </TooltipProvider>
                )}
            </div>
        </section>
    )
}
