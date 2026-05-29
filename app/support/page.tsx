"use client"

import { useState, useEffect } from "react"
import { Heart, ChevronRight, MessageCircle } from "lucide-react"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { SponsorWall } from "@/components/support/SponsorWall"
import { DonateDialog } from "@/components/support/DonateDialog"
import { urlService } from "@/lib/services/urlService"
import { openUrl } from "@tauri-apps/plugin-opener"

export default function SupportPage() {
    const { isLoggedIn } = useAuthStore()
    const [donateOpen, setDonateOpen] = useState(false)
    const [qqGroup, setQqGroup] = useState<{ enabled: boolean; url: string; name: string } | null>(null)

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${urlService.baseUrl}/config/public`)
                if (res.ok) {
                    const json = await res.json()
                    setQqGroup(json?.data?.qq_group || null)
                }
            } catch (e) {
                console.error("Failed to fetch public config:", e)
            }
        }
        fetchConfig()
    }, [])

    const handleJoinQQGroup = async () => {
        if (!qqGroup?.url) return
        try {
            await openUrl(qqGroup.url)
        } catch (e) {
            console.error("Failed to open URL via Tauri:", e)
            window.open(qqGroup.url, '_blank')
        }
    }

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex items-center space-x-2 h-8">
                <h1 className="text-2xl font-bold">支持</h1>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-left-4 duration-300 pb-10">
                    {/* 赞助入口 - 仅登录用户可见 */}
                    {isLoggedIn && (
                        <section className="space-y-4">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">支持与赞助</h2>
                                <p className="text-sm text-muted-foreground">
                                    您的支持是我们持续维护与改进的最大动力
                                </p>
                            </div>

                            <div
                                className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                onClick={() => setDonateOpen(true)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                                        <Heart className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-medium leading-none">赞助项目</h3>
                                        <p className="text-xs text-muted-foreground">
                                            赞助任意金额，您的名字将被永久保留在赞助墙上
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                            </div>
                        </section>
                    )}

                    {/* 社区交流 */}
                    {qqGroup?.enabled && qqGroup?.url && (
                        <section className="space-y-4">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">社区交流</h2>
                                <p className="text-sm text-muted-foreground">
                                    加入我们的交流群，获取最新资讯与帮助
                                </p>
                            </div>

                            <div
                                className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                onClick={handleJoinQQGroup}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                        <MessageCircle className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-medium leading-none">{qqGroup.name || "官方 QQ 群"}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            点击加入 QQ 群，与其他用户分享交流
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                            </div>
                        </section>
                    )}

                    {/* 赞助墙 */}
                    <SponsorWall />
                </div>
            </div>

            <DonateDialog open={donateOpen} onOpenChange={setDonateOpen} />
        </div>
    )
}
