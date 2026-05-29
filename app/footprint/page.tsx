"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    ChevronRight,
    Loader2,
    Headphones,
    Footprints
} from "lucide-react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { listeningStatsService } from "@/lib/services/listeningStatsService"
import { ProfileStats } from "@/components/profile/ProfileStats"
import { TopRankingSection } from "@/components/profile/TopRankingSection"
import { WeeklyAlbumWall } from "@/components/profile/WeeklyAlbumWall"
import { LanguageStatsSection } from "@/components/profile/LanguageStatsSection"

export default function FootprintPage() {
    const { isLoggedIn } = useAuthStore()
    const router = useRouter()
    const [stats, setStats] = useState<any>(null)
    const [weeklyPlays, setWeeklyPlays] = useState<any[] | null>(null)
    const [languageStats, setLanguageStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isLoggedIn) {
            router.push("/profile")
            return
        }
        fetchStats()
    }, [isLoggedIn])

    const fetchStats = async () => {
        setLoading(true)
        try {
            const [statsData, weeklyPlaysData, languageData] = await Promise.all([
                listeningStatsService.fetchStats(),
                listeningStatsService.fetchWeeklyPlays(),
                listeningStatsService.fetchLanguageStats()
            ])
            setStats(statsData)
            setWeeklyPlays(weeklyPlaysData)
            setLanguageStats(languageData)
        } catch (error) {
            console.error("Failed to fetch stats:", error)
        }
        setLoading(false)
    }

    const topPlays = stats?.playCounts?.slice(0, 10) || []

    const titleBar = (
        <div className="px-6 lg:px-10 pt-6 lg:pt-10 max-w-7xl w-full mx-auto">
            <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl flex items-center min-w-0">
                <span
                    className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    onClick={() => router.push("/profile")}
                >
                    个人中心
                </span>
                <ChevronRight className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground shrink-0" />
                <span className="text-foreground">听歌足迹</span>
            </h1>
        </div>
    )

    const renderBody = () => {
        if (loading) {
            return (
                <div className="flex min-h-[60vh] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            )
        }

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="px-6 lg:px-10 pb-32 space-y-10 max-w-7xl mx-auto"
            >


                <ProfileStats stats={stats} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start lg:items-stretch">
                    <WeeklyAlbumWall weeklyPlays={weeklyPlays} />
                    <LanguageStatsSection languageStats={languageStats} />
                </div>

                <TopRankingSection topPlays={topPlays} />
            </motion.div>
        )
    }

    return (
        <ScrollArea className="h-full">
            {titleBar}
            <div className="mt-6 lg:mt-8">
                {renderBody()}
            </div>
        </ScrollArea>
    )
}