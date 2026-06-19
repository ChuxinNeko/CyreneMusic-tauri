"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, Server, ChevronLeft, User, Music, Music2, KeyRound, Info, FileText, Settings2, Palette, RefreshCw, HardDrive, Sparkles, Trophy } from "lucide-react"
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
import { AudioQuality } from "@/lib/services/audioSourceService"
import { lxMusicRuntimeService } from "@/lib/services/lxMusicRuntimeService"
import { AudioSourceType } from "@/lib/models/audioSourceConfig"
import { AudioSourceManager } from "@/components/settings/AudioSourceManager"
import { AccountBindingManager } from "@/components/settings/AccountBindingManager"
import { QualitySettingsDialog } from "@/components/settings/QualitySettingsDialog"
import { useAudioSourceStore } from "@/lib/store/useAudioSourceStore"
import { AppearanceSettingsManager } from "@/components/settings/AppearanceSettingsManager"
import { CacheSettingsManager } from "@/components/settings/CacheSettingsManager"
import { PlayerSettingsManager } from "@/components/settings/PlayerSettingsManager"
import { useTheme } from "next-themes"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { FluentProvider, webLightTheme, webDarkTheme, Text, Switch as FluentSwitch, Card as FluentCard, CardHeader as FluentCardHeader } from "@fluentui/react-components"
import { RwuiSelect } from "@/components/rwui/RwuiSelect"
import { RwuiSwitch } from "@/components/rwui/RwuiSwitch"
import { useUIThemeStore } from "@/lib/store/useUIThemeStore"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

import Image from "next/image"
import { motion } from "framer-motion"
import { UserAgreementContent } from "@/components/common/UserAgreementContent"
import { updateService, UpdateInfo } from "@/lib/services/updateService"
import { UpdateDialog } from "@/components/common/UpdateDialog"

type SettingsView = "main" | "backend-source" | "audio-source" | "account-binding" | "appearance" | "player" | "about" | "user-agreement" | "cache-management"

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
    const { quality, setQuality, sources } = useAudioSourceStore()
    const { theme } = useTheme()
    const { currentTheme } = useUIThemeStore()
    const { showDailyRecommendPopup, setShowDailyRecommendPopup, triggerRecommendPopup, toplistSource, setToplistSource, recommendSource, setRecommendSource } = useLayoutStore()

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

    const qualityLabels: Record<string, { label: string }> = {
        [AudioQuality.Standard]: { label: "标准" },
        [AudioQuality.ExHigh]: { label: "极高" },
        [AudioQuality.Lossless]: { label: "无损" },
        [AudioQuality.HiRes]: { label: "Hi-Res" },
        '128k': { label: "标准" },
        '320k': { label: "极高" },
        'flac': { label: "无损" },
        'flac24bit': { label: "Hi-Res" },
    }

    const qualityOptions = (() => {
        const isLxMusic = activeSource?.type === AudioSourceType.LxMusic
        let options: { value: string; label: string }[] = [
            { value: AudioQuality.Standard, label: "标准" },
            { value: AudioQuality.ExHigh, label: "极高" },
            { value: AudioQuality.Lossless, label: "无损" },
            { value: AudioQuality.HiRes, label: "Hi-Res" },
        ]
        if (isLxMusic) {
            const supported = lxMusicRuntimeService.currentScript?.supportedQualities
            if (supported && supported.length > 0) {
                options = supported.map(q => ({
                    value: q,
                    label: qualityLabels[q]?.label || q.toUpperCase(),
                }))
            }
        }
        return options
    })()

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
        } else if (view === "player") {
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setView("main")}
                    >
                        设置
                    </span>
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    <span className="text-foreground">播放器设置</span>
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

interface SettingsSectionHeaderProps {
    icon: React.ElementType;
    title: string;
    description: string;
}

const SettingsSectionHeader = ({ icon: Icon, title, description }: SettingsSectionHeaderProps) => {
    const { currentTheme } = useUIThemeStore();

    if (currentTheme === "fluent") {
        return (
            <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                    <Icon className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                    {title}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {description}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {title}
            </h2>
            <p className="text-sm text-muted-foreground">
                {description}
            </p>
        </div>
    );
};

const SettingsItemGroup = ({ children }: { children: React.ReactNode }) => {
    const { currentTheme } = useUIThemeStore();

    if (currentTheme === "fluent") {
        return (
            <div className="flex flex-col gap-1.5">
                {children}
            </div>
        );
    }

    return (
        <div className="flex flex-col border border-border/40 rounded-xl overflow-hidden bg-card/60 backdrop-blur-xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 divide-y divide-border/40">
            {children}
        </div>
    );
};

interface SettingsItemProps {
    icon: React.ElementType;
    title: string;
    description?: React.ReactNode;
    onClick: () => void;
    rightElement?: React.ReactNode;
    fluentRightElement?: React.ReactNode;
}

const SettingsItem = ({ icon: Icon, title, description, onClick, rightElement, fluentRightElement }: SettingsItemProps) => {
    const { currentTheme } = useUIThemeStore();
    
    if (currentTheme === "fluent") {
        return (
            <FluentCard 
                orientation="horizontal" 
                appearance="subtle" 
                onClick={onClick}
                className="w-full cursor-pointer bg-white/95 dark:bg-[#2d2d2d]/85 backdrop-blur-2xl hover:bg-neutral-50 dark:hover:bg-[#383838]/85 border border-black/[0.05] dark:border-white/[0.08] shadow-sm rounded-lg transition-colors"
            >
                <FluentCardHeader
                    image={<Icon className="h-5 w-5 ml-1 mr-2 text-neutral-700 dark:text-neutral-300" />}
                    header={<Text className="block truncate font-medium">{title}</Text>}
                    description={description ? <Text size={200} className="block truncate text-neutral-500 dark:text-neutral-400">{description}</Text> : undefined}
                    action={fluentRightElement || rightElement || <ChevronRight className="h-4 w-4 text-neutral-400" />}
                />
            </FluentCard>
        );
    }

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

    const content = (
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
                            <SettingsSectionHeader icon={User} title="账号" description="管理您的个人资料及同步设置" />
                            <UserCard className="rounded-xl" onLoginClick={() => setAuthDialogOpen(true)} />
                        </section>

                        <section className="space-y-3">
                            <SettingsSectionHeader icon={Palette} title="界面" description="个性化视觉与交互体验" />

                            <SettingsItemGroup>
                                <SettingsItem
                                    icon={Palette}
                                    title="外观设置"
                                    description={theme === "dark" ? "深色模式" : theme === "light" ? "浅色模式" : "跟随系统"}
                                    onClick={() => setView("appearance")}
                                />
                                <SettingsItem
                                    icon={Sparkles}
                                    title="启动推荐"
                                    description="启动时在右下角弹出歌曲推荐"
                                    onClick={() => {}}
                                    rightElement={
                                        <div className="flex items-center gap-3">
                                            {!showDailyRecommendPopup && (
                                                <button
                                                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors whitespace-nowrap"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        triggerRecommendPopup()
                                                        toast.success("正在加载推荐歌曲...")
                                                    }}
                                                >
                                                    显示一次
                                                </button>
                                            )}
                                            <Switch
                                                checked={showDailyRecommendPopup}
                                                onCheckedChange={(checked) => {
                                                    setShowDailyRecommendPopup(checked)
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    }
                                    fluentRightElement={
                                        <div className="flex items-center gap-3">
                                            {!showDailyRecommendPopup && (
                                                <button
                                                    className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors whitespace-nowrap"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        triggerRecommendPopup()
                                                        toast.success("正在加载推荐歌曲...")
                                                    }}
                                                >
                                                    显示一次
                                                </button>
                                            )}
                                            <div onClick={(e) => e.stopPropagation()} className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                                <RwuiSwitch
                                                    checked={showDailyRecommendPopup}
                                                    onChange={(checked) => {
                                                        setShowDailyRecommendPopup(checked)
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    }
                                />
                            </SettingsItemGroup>
                        </section>

                        <section className="space-y-3">
                            <SettingsSectionHeader icon={Server} title="服务" description="配置后端连接及数据来源" />

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
                                    icon={Trophy}
                                    title="榜单来源"
                                    description="首页「全部榜单」的数据来源"
                                    onClick={() => {}}
                                    rightElement={
                                        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60" onClick={(e) => e.stopPropagation()}>
                                            {(["netease", "qq"] as const).map((src) => (
                                                <button
                                                    key={src}
                                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                                        toplistSource === src
                                                            ? "bg-background text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setToplistSource(src)
                                                        toast.success(src === 'qq' ? '已切换为 QQ 音乐榜单' : '已切换为网易云音乐榜单')
                                                    }}
                                                >
                                                    {src === 'qq' ? 'QQ 音乐' : '网易云'}
                                                </button>
                                            ))}
                                        </div>
                                    }
                                    fluentRightElement={
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <RwuiSelect
                                                data={[
                                                    { label: "网易云", value: "netease" },
                                                    { label: "QQ 音乐", value: "qq" },
                                                ]}
                                                value={toplistSource}
                                                onChange={(value) => {
                                                    const src = value as "netease" | "qq"
                                                    setToplistSource(src)
                                                    toast.success(src === 'qq' ? '已切换为 QQ 音乐榜单' : '已切换为网易云音乐榜单')
                                                }}
                                                style={{ width: 80 }}
                                            />
                                        </div>
                                    }
                                />
                                <SettingsItem
                                    icon={Sparkles}
                                    title="为你推荐源"
                                    description="首页「为你推荐」的数据来源"
                                    onClick={() => {}}
                                    rightElement={
                                        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60" onClick={(e) => e.stopPropagation()}>
                                            {(["netease", "qq"] as const).map((src) => (
                                                <button
                                                    key={src}
                                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                                        recommendSource === src
                                                            ? "bg-background text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setRecommendSource(src)
                                                        toast.success(src === 'qq' ? '已切换为 QQ音乐推荐' : '已切换为网易云音乐推荐')
                                                    }}
                                                >
                                                    {src === 'qq' ? 'QQ 音乐' : '网易云'}
                                                </button>
                                            ))}
                                        </div>
                                    }
                                    fluentRightElement={
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <RwuiSelect
                                                data={[
                                                    { label: "网易云", value: "netease" },
                                                    { label: "QQ 音乐", value: "qq" },
                                                ]}
                                                value={recommendSource}
                                                onChange={(value) => {
                                                    const src = value as "netease" | "qq"
                                                    setRecommendSource(src)
                                                    toast.success(src === 'qq' ? '已切换为 QQ音乐推荐' : '已切换为网易云音乐推荐')
                                                }}
                                                style={{ width: 80 }}
                                            />
                                        </div>
                                    }
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
                            <SettingsSectionHeader icon={Music2} title="播放" description="自定义音乐播放体验" />

                            <SettingsItemGroup>
                                <SettingsItem
                                    icon={Settings2}
                                    title="音质选择"
                                    description={`当前选择: ${quality === 'standard' || quality === '128k' ? '标准' : quality === 'exhigh' || quality === '320k' ? '极高' : quality === 'lossless' || quality === 'flac' ? '无损' : quality === 'hires' || quality === 'flac24bit' ? 'Hi-Res' : quality.toUpperCase()}`}
                                    onClick={() => setQualityDialogOpen(true)}
                                    fluentRightElement={
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <RwuiSelect
                                                data={qualityOptions}
                                                value={quality}
                                                onChange={(value) => setQuality(value as AudioQuality)}
                                                style={{ width: 100 }}
                                            />
                                        </div>
                                    }
                                />
                                <SettingsItem
                                    icon={Music2}
                                    title="播放器设置"
                                    description="歌词、字体、背景与桌面歌词"
                                    onClick={() => setView("player")}
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

                {view === "player" && (
                    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                        <PlayerSettingsManager />
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

    if (currentTheme === "fluent") {
        return (
            <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme} style={{ height: "100%", backgroundColor: "transparent" }}>
                {content}
            </FluentProvider>
        )
    }

    return content

}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center">加载中...</div>}>
            <SettingsPageContent />
        </Suspense>
    )
}
