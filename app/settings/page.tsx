"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, Server, ChevronLeft, User, Music, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { urlService, BackendSourceType } from "@/lib/services/urlService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { AuthDialog } from "@/components/auth/AuthDialog"
import { UserCard } from "@/components/auth/UserCard"
import { useActiveSource } from "@/lib/store/useAudioSourceStore"
import { AudioSourceManager } from "@/components/settings/AudioSourceManager"
import { AccountBindingManager } from "@/components/settings/AccountBindingManager"

type SettingsView = "main" | "backend-source" | "audio-source" | "account-binding"

export default function SettingsPage() {
    const [view, setView] = useState<SettingsView>("main")
    const [sourceType, setSourceType] = useState<BackendSourceType>(BackendSourceType.Official)
    const [customUrl, setCustomUrl] = useState("")
    const { user, isLoggedIn, logout } = useAuthStore()
    const [authDialogOpen, setAuthDialogOpen] = useState(false)
    const activeSource = useActiveSource()

    useEffect(() => {
        // Initial load
        setSourceType(urlService.sourceType)
        setCustomUrl(urlService.customBaseUrl)

        // Subscribe to changes
        const unsubscribe = urlService.subscribe(() => {
            setSourceType(urlService.sourceType)
            setCustomUrl(urlService.customBaseUrl)
        })

        return () => unsubscribe()
    }, [])

    const handleSourceChange = (value: string) => {
        const type = value as BackendSourceType
        urlService.setSourceType(type)
    }

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value
        setCustomUrl(url)
        urlService.setCustomBaseUrl(url)
    }

    // Breadcrumb logic
    const getBreadcrumb = () => {
        if (view === "main") {
            return "设置"
        } else if (view === "backend-source") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">后端源</span>
                </div>
            )
        } else if (view === "audio-source") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">音源设置</span>
                </div>
            )
        } else if (view === "account-binding") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">第三方账号绑定</span>
                </div>
            )
        }
    }

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex items-center space-x-2 h-8">
                <h1 className="text-2xl font-bold flex items-center">
                    {view === "main" ? "设置" : getBreadcrumb()}
                </h1>
            </div>

            <div className="flex-1 overflow-auto">
                {view === "main" && (
                    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-left-4 duration-300 pb-10">
                        <section className="space-y-4">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">账号</h2>
                                <p className="text-sm text-muted-foreground">
                                    管理您的个人资料及同步设置
                                </p>
                            </div>
                            <UserCard onLoginClick={() => setAuthDialogOpen(true)} />
                        </section>

                        <section className="space-y-4">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">服务</h2>
                                <p className="text-sm text-muted-foreground">
                                    配置后端连接及数据来源
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div
                                    className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setView("audio-source")}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <Music className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium leading-none">音源设置</h3>
                                            <p className="text-xs text-muted-foreground">
                                                {activeSource
                                                    ? `当前使用: ${activeSource.name}`
                                                    : "未配置音源，歌曲可能无法播放"}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                </div>

                                <div
                                    className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setView("backend-source")}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <Server className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium leading-none">后端源</h3>
                                            <p className="text-xs text-muted-foreground">
                                                {sourceType === BackendSourceType.Official
                                                    ? "当前使用官方源"
                                                    : `自定义源: ${customUrl || "未配置"}`}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                </div>

                                <div
                                    className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setView("account-binding")}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <KeyRound className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium leading-none">第三方账号绑定</h3>
                                            <p className="text-xs text-muted-foreground">
                                                同步网易云、酷狗音乐等平台数据
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {view === "audio-source" && (
                    <div className="max-w-2xl mx-auto pb-10">
                        <AudioSourceManager />
                    </div>
                )}

                {view === "account-binding" && (
                    <div className="max-w-2xl mx-auto pb-10">
                        <AccountBindingManager />
                    </div>
                )}

                {view === "backend-source" && (
                    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                        <Card className="border-none shadow-none bg-transparent">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle>后端服务配置</CardTitle>
                                <CardDescription>
                                    选择应用数据来源。官方源稳定可靠，自定义源适合高级用户。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 px-0">
                                <RadioGroup value={sourceType} onValueChange={handleSourceChange} className="grid grid-cols-1 gap-4">
                                    <div>
                                        <RadioGroupItem value={BackendSourceType.Official} id="official" className="peer sr-only" />
                                        <Label
                                            htmlFor="official"
                                            className="flex items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                        >
                                            <div className="space-y-1">
                                                <div className="font-semibold">官方源</div>
                                                <div className="text-sm text-muted-foreground">
                                                    使用 Cyrene Music 提供的默认服务
                                                </div>
                                            </div>
                                            <div className="h-4 w-4 rounded-full border border-primary opacity-0 peer-data-[state=checked]:opacity-100 bg-primary" />
                                        </Label>
                                    </div>

                                    <div>
                                        <RadioGroupItem value={BackendSourceType.Custom} id="custom" className="peer sr-only" />
                                        <Label
                                            htmlFor="custom"
                                            className="flex items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                                        >
                                            <div className="space-y-1">
                                                <div className="font-semibold">自定义源</div>
                                                <div className="text-sm text-muted-foreground">
                                                    连接到您自己部署的后端服务
                                                </div>
                                            </div>
                                            <div className="h-4 w-4 rounded-full border border-primary opacity-0 peer-data-[state=checked]:opacity-100 bg-primary" />
                                        </Label>
                                    </div>
                                </RadioGroup>

                                {sourceType === BackendSourceType.Custom && (
                                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                                        <Label htmlFor="custom-url">服务地址</Label>
                                        <Input
                                            id="custom-url"
                                            placeholder="https://api.example.com"
                                            value={customUrl}
                                            onChange={handleUrlChange}
                                            className="h-10"
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {customUrl && !urlService.isValidUrl(customUrl) && (
                                                <span className="text-destructive flex items-center gap-1">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive" />
                                                    请输入有效的 HTTP 或 HTTPS 地址
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        </div>
    )
}
