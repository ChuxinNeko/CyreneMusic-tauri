"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, Server, ChevronLeft, User, Music, KeyRound, Info, FileText, Settings2, Palette, RefreshCw, HardDrive } from "lucide-react"
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
import { QualitySettingsDialog } from "@/components/settings/QualitySettingsDialog"
import { useAudioSourceStore } from "@/lib/store/useAudioSourceStore"
import { AppearanceSettingsManager } from "@/components/settings/AppearanceSettingsManager"
import { CacheSettingsManager } from "@/components/settings/CacheSettingsManager"
import { useTheme } from "next-themes"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

import Image from "next/image"
import { motion } from "framer-motion"
import { UserAgreementContent } from "@/components/common/UserAgreementContent"
import { updateService, UpdateInfo } from "@/lib/services/updateService"
import { UpdateDialog } from "@/components/common/UpdateDialog"

type SettingsView = "main" | "backend-source" | "audio-source" | "account-binding" | "appearance" | "about" | "user-agreement" | "cache-management"

function SettingsPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const view = (searchParams.get("v") as SettingsView) || "main"

    const setView = (newView: SettingsView) => {
        const params = new URLSearchParams(searchParams.toString())
        if (newView === "main") {
            params.delete("v")
        } else {
            params.set("v", newView)
        }
        router.push(`/settings?${params.toString()}`)
    }

    const [sourceType, setSourceType] = useState<BackendSourceType>(BackendSourceType.Official)
    const [customUrl, setCustomUrl] = useState("")
    const { user, isLoggedIn, logout } = useAuthStore()
    const [authDialogOpen, setAuthDialogOpen] = useState(false)
    const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [showUpdateDialog, setShowUpdateDialog] = useState(false)
    const [checkingUpdate, setCheckingUpdate] = useState(false)
    const [updateCheckResult, setUpdateCheckResult] = useState<"latest" | "found" | null>(null)
    const activeSource = useActiveSource()
    const { quality, sources } = useAudioSourceStore()
    const { theme } = useTheme()

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

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true)
        setUpdateCheckResult(null)
        try {
            const info = await updateService.checkUpdate()
            if (info) {
                setUpdateInfo(info)
                setShowUpdateDialog(true)
                setUpdateCheckResult("found")
            } else {
                setUpdateCheckResult("latest")
            }
        } catch {
            setUpdateCheckResult("latest")
        } finally {
            setCheckingUpdate(false)
        }
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
        } else if (view === "appearance") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">外观设置</span>
                </div>
            )
        } else if (view === "about") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">关于</span>
                </div>
            )
        } else if (view === "user-agreement") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("about")}
                    >
                        关于
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">用户协议</span>
                </div>
            )
        } else if (view === "cache-management") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">缓存管理</span>
                </div>
            )
        }
    }

const SettingsItemGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col border rounded-xl overflow-hidden bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 divide-y">
        {children}
    </div>
);

interface SettingsItemProps {
    icon: React.ElementType;
    title: string;
    description?: React.ReactNode;
    onClick: () => void;
    rightElement?: React.ReactNode;
}

const SettingsItem = ({ icon: Icon, title, description, onClick, rightElement }: SettingsItemProps) => {
    return (
        <div
            className="group flex items-center justify-between p-4 bg-transparent hover:bg-accent/40 cursor-pointer transition-colors duration-200"
            onClick={onClick}
        >
            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <div className="flex shrink-0 items-center justify-center w-10 h-10 bg-primary/10 rounded-xl group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-sm font-medium leading-none group-hover:text-primary transition-colors truncate">{title}</h3>
                    {description && (
                        <p className="text-xs text-muted-foreground truncate transition-colors">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center shrink-0 ml-4 text-muted-foreground/50 group-hover:text-foreground transition-colors">
                {rightElement || <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-all" />}
            </div>
        </div>
    );
};

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex items-center space-x-2 h-8">
                <h1 className="text-2xl font-bold flex items-center">
                    {view === "main" ? "设置" : getBreadcrumb()}
                </h1>
            </div>

            <div className="flex-1 overflow-auto">
                {view === "main" && (
                    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-left-4 duration-300 pb-10">
                        <section className="space-y-3">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">账号</h2>
                                <p className="text-sm text-muted-foreground">
                                    管理您的个人资料及同步设置
                                </p>
                            </div>
                            <UserCard onLoginClick={() => setAuthDialogOpen(true)} />
                        </section>

                        <section className="space-y-3">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">界面</h2>
                                <p className="text-sm text-muted-foreground">
                                    个性化视觉与交互体验
                                </p>
                            </div>

                            <SettingsItemGroup>
                                <SettingsItem
                                    icon={Palette}
                                    title="外观设置"
                                    description={theme === "dark" ? "深色模式" : theme === "light" ? "浅色模式" : "跟随系统"}
                                    onClick={() => setView("appearance")}
                                />
                            </SettingsItemGroup>
                        </section>

                        <section className="space-y-3">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">服务</h2>
                                <p className="text-sm text-muted-foreground">
                                    配置后端连接及数据来源
                                </p>
                            </div>

                            <SettingsItemGroup>
                                <SettingsItem
                                    icon={Music}
                                    title="音源设置"
                                    description={activeSource ? `${sources.length} 个音源 · 优先: ${activeSource.name}` : "未配置音源，歌曲可能无法播放"}
                                    onClick={() => setView("audio-source")}
                                />
                                <SettingsItem
                                    icon={Server}
                                    title="后端源"
                                    description={sourceType === BackendSourceType.Official ? "当前使用官方源" : `自定义源: ${customUrl || "未配置"}`}
                                    onClick={() => setView("backend-source")}
                                />
                                <SettingsItem
                                    icon={KeyRound}
                                    title="第三方账号绑定"
                                    description="同步网易云、酷狗音乐等平台数据"
                                    onClick={() => setView("account-binding")}
                                />
                                <SettingsItem
                                    icon={Info}
                                    title="关于"
                                    description="关于 CyreneMusicNext"
                                    onClick={() => setView("about")}
                                />
                            </SettingsItemGroup>
                        </section>

                        <section className="space-y-3">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">播放</h2>
                                <p className="text-sm text-muted-foreground">
                                    自定义音乐播放体验
                                </p>
                            </div>

                            <SettingsItemGroup>
                                <SettingsItem
                                    icon={Settings2}
                                    title="音质选择"
                                    description={`当前选择: ${quality === 'standard' || quality === '128k' ? '标准' : quality === 'exhigh' || quality === '320k' ? '极高' : quality === 'lossless' || quality === 'flac' ? '无损' : quality === 'hires' || quality === 'flac24bit' ? 'Hi-Res' : quality.toUpperCase()}`}
                                    onClick={() => setQualityDialogOpen(true)}
                                />
                                <SettingsItem
                                    icon={HardDrive}
                                    title="缓存管理"
                                    description="管理本地加密音频缓存，离线可用"
                                    onClick={() => setView("cache-management")}
                                />
                            </SettingsItemGroup>
                        </section>
                    </div>
                )}

                {view === "appearance" && (
                    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                        <AppearanceSettingsManager />
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

                {view === "cache-management" && (
                    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                        <CacheSettingsManager />
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

                {view === "about" && (
                    <div className="flex flex-col items-center justify-start h-full pt-8 px-6 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-300">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="flex flex-col items-center text-center space-y-6 max-w-2xl w-full"
                        >
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-white/20 to-white/5 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                                <div className="relative bg-black/5 dark:bg-white/5 rounded-[2.5rem] p-4 backdrop-blur-xl border border-white/10 ring-1 ring-white/5">
                                    <Image
                                        src="/ico.png"
                                        alt="CyreneMusicNext Icon"
                                        width={100}
                                        height={100}
                                        className="rounded-3xl shadow-2xl transition-transform duration-500 group-hover:scale-105"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent" style={{ fontFamily: 'MiSans, sans-serif' }}>
                                    CyreneMusicNext
                                </h1>
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                                    Version {process.env.NEXT_PUBLIC_APP_VERSION}
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                className="gap-2 rounded-xl"
                                onClick={handleCheckUpdate}
                                disabled={checkingUpdate}
                            >
                                <RefreshCw className={`h-4 w-4 ${checkingUpdate ? "animate-spin" : ""}`} />
                                {checkingUpdate ? "检查中..." : "检查更新"}
                            </Button>

                            {updateCheckResult === "latest" && (
                                <p className="text-sm text-muted-foreground">当前已是最新版本</p>
                            )}

                            <div className="flex flex-col items-center space-y-1 !mt-2">
                                <Button
                                    variant="ghost"
                                    className="group/btn flex items-center gap-2 px-4 py-2 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all duration-300"
                                    onClick={() => setView("user-agreement")}
                                >
                                    <FileText className="h-4 w-4 text-primary/60 group-hover/btn:text-primary transition-colors" />
                                    <span className="text-sm font-medium text-muted-foreground group-hover/btn:text-foreground transition-colors">用户协议</span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover/btn:text-primary group-hover/btn:translate-x-0.5 transition-all" />
                                </Button>
                            </div>

                            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-foreground/10 to-transparent rounded-full !mt-12" />

                            <div className="flex flex-col items-center space-y-4 !mt-8">
                                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">Powered by</span>
                                <div className="flex items-center gap-8">
                                    <div className="group/logo relative">
                                        <Image
                                            src="/LogosNextjs.svg"
                                            alt="Next.js"
                                            width={80}
                                            height={20}
                                            className="opacity-40 grayscale group-hover/logo:opacity-100 group-hover/logo:grayscale-0 transition-all duration-500"
                                        />
                                    </div>
                                    <div className="group/logo relative">
                                        <Image
                                            src="/LogosTauri.svg"
                                            alt="Tauri"
                                            width={20}
                                            height={20}
                                            className="opacity-40 grayscale group-hover/logo:opacity-100 group-hover/logo:grayscale-0 transition-all duration-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
                {view === "user-agreement" && (
                    <div className="flex flex-col items-center justify-start h-full pt-4 px-6 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="w-full max-w-3xl h-full flex flex-col bg-card/50 backdrop-blur-md border rounded-2xl shadow-xl">
                            <div className="p-6 border-b flex items-center justify-between bg-muted/30">
                                <h2 className="text-xl font-bold">CyreneMusic 使用协议</h2>
                                <div className="text-xs text-muted-foreground px-2 py-1 rounded bg-background/50 border">Apache-2.0</div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <UserAgreementContent />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
            <QualitySettingsDialog open={qualityDialogOpen} onOpenChange={setQualityDialogOpen} />
            <UpdateDialog updateInfo={updateInfo} open={showUpdateDialog} onOpenChange={setShowUpdateDialog} />
        </div>
    )
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center">加载中...</div>}>
            <SettingsPageContent />
        </Suspense>
    )
}
