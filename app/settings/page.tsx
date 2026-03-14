"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, Server, ChevronLeft, User, Music, KeyRound, Info, FileText, Settings2, Palette } from "lucide-react"
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
import { useTheme } from "next-themes"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

import Image from "next/image"
import { motion } from "framer-motion"

type SettingsView = "main" | "backend-source" | "audio-source" | "account-binding" | "appearance" | "about" | "user-agreement"

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
    const activeSource = useActiveSource()
    const { quality } = useAudioSourceStore()
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
                                <h2 className="text-lg font-semibold tracking-tight">界面</h2>
                                <p className="text-sm text-muted-foreground">
                                    个性化视觉与交互体验
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div
                                    className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setView("appearance")}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <Palette className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium leading-none">外观设置</h3>
                                            <p className="text-xs text-muted-foreground">
                                                {theme === "dark" ? "深色模式" : theme === "light" ? "浅色模式" : "跟随系统"}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                </div>
                            </div>
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
                                <div
                                    className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setView("about")}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <Info className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium leading-none">关于</h3>
                                            <p className="text-xs text-muted-foreground">
                                                关于 CyreneMusicNext
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">播放</h2>
                                <p className="text-sm text-muted-foreground">
                                    自定义音乐播放体验
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div
                                    className="group flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-accent/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                                    onClick={() => setQualityDialogOpen(true)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <Settings2 className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium leading-none">音质选择</h3>
                                            <p className="text-xs text-muted-foreground">
                                                当前选择：{
                                                    quality === 'standard' || quality === '128k' ? '标准' :
                                                        quality === 'exhigh' || quality === '320k' ? '极高' :
                                                            quality === 'lossless' || quality === 'flac' ? '无损' :
                                                                quality === 'hires' || quality === 'flac24bit' ? 'Hi-Res' : quality.toUpperCase()
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                </div>
                            </div>
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
                                    Version 1.0.0
                                </div>
                            </div>



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
                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar text-sm leading-relaxed text-foreground/80">
                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        词语约定
                                    </h3>
                                    <ul className="space-y-2 pl-3 border-l-2 border-primary/10">
                                        <li><strong>“本项目”</strong> 指 CyreneMusic 应用及其相关开源代码；</li>
                                        <li><strong>“使用者”</strong> 指下载、安装、运行或以任何方式使用本项目的个人或组织；</li>
                                        <li><strong>“音源”</strong> 指由使用者自行导入或配置的第三方音频数据来源（包括但不限于 API、链接、本地文件路径等）；</li>
                                        <li><strong>“版权数据”</strong> 指包括但不限于音频、专辑封面、歌曲名、艺术家信息等受知识产权保护的内容。</li>
                                    </ul>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        一、数据来源与播放机制
                                    </h3>
                                    <div className="space-y-2">
                                        <p>1.1 <strong>本项目 本身不具备获取音频流的能力。</strong>所有音频播放均依赖于使用者自行导入或配置的“音源”。本项目仅将用户输入的歌曲信息（如标题、艺术家等）传递给所选音源，并播放其返回的音频链接。</p>
                                        <p>1.2 <strong>本项目 不对音源返回内容的合法性、准确性、完整性或可用性作任何保证。</strong>若音源返回错误、无关、失效或侵权内容，由此产生的任何问题均由使用者及音源提供方承担，本项目开发者不承担任何责任。</p>
                                        <p>1.3 使用者应自行确保所导入音源的合法性，并对其使用行为负全部法律责任。</p>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        二、账号与数据同步
                                    </h3>
                                    <div className="space-y-2">
                                        <p>2.1 <strong>本平台提供的账号系统</strong> 仅用于云端保存歌单、播放历史等用户偏好数据，不用于身份认证、商业推广、数据分析或其他用途。</p>
                                        <p>2.2 所有同步至云端的数据均由使用者主动上传，本项目不对这些数据的内容、合法性或安全性负责。</p>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        三、版权与知识产权
                                    </h3>
                                    <div className="space-y-2">
                                        <p>3.1 本项目 不存储、不分发、不缓存任何音频文件或版权数据。所有版权数据均由使用者通过外部音源实时获取。</p>
                                        <p>3.2 使用者在使用本项目过程中接触到的任何版权内容（如歌曲、专辑图等），其权利归属于原著作权人。使用者应遵守所在国家/地区的版权法律法规。</p>
                                        <p>3.3 <strong>强烈建议使用者在24小时内清除本地缓存的版权数据（如有）</strong>，以避免潜在侵权风险。本项目不主动缓存音频，但部分系统或浏览器可能自动缓存，使用者需自行管理。</p>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        四、开源与许可
                                    </h3>
                                    <div className="space-y-2">
                                        <p>4.1 本项目为 <strong>完全开源软件</strong>，基于 Apache License 2.0 发布。使用者可自由使用、修改、分发本项目代码，但须遵守 Apache 2.0 许可证条款。</p>
                                        <p>4.2 本项目中使用的第三方资源（如图标、字体等）均注明来源。若存在未授权使用情况，请联系开发者及时移除。</p>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        五、免责声明
                                    </h3>
                                    <div className="space-y-2">
                                        <p>5.1 使用者理解并同意：因使用本项目或依赖外部音源所导致的任何直接或间接损失（包括但不限于数据丢失、设备损坏、法律纠纷、隐私泄露等），均由使用者自行承担。</p>
                                        <p>5.2 <strong>本项目开发者 不对本项目的功能完整性、稳定性、安全性或适配性作任何明示或暗示的担保。</strong></p>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        六、使用限制
                                    </h3>
                                    <div className="space-y-2">
                                        <p>6.1 本项目 <strong>仅用于技术学习、个人非商业用途</strong>。禁止将本项目用于任何违反当地法律法规的行为（如盗版传播、侵犯版权、非法爬取等）。</p>
                                        <p>6.2 若使用者所在司法管辖区禁止使用此类工具，使用者应立即停止使用。因违规使用所引发的一切后果，由使用者自行承担。</p>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        七、尊重版权
                                    </h3>
                                    <p>7.1 音乐创作不易，请尊重艺术家与版权方的劳动成果。支持正版音乐，优先使用合法授权的音源服务。</p>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-primary font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        八、协议接受
                                    </h3>
                                    <div className="space-y-2">
                                        <p>8.1 <strong>一旦您下载、安装、运行或以任何方式使用 CyreneMusic，即视为您已阅读、理解并无条件接受本协议全部条款。</strong></p>
                                        <p>8.2 本协议可能随项目更新而修订，修订后将发布于项目仓库。继续使用即视为接受最新版本。</p>
                                    </div>
                                </section>

                                <div className="pt-10 pb-4 text-center text-xs text-muted-foreground italic">
                                    最后更新日期：2026年2月21日
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
            <QualitySettingsDialog open={qualityDialogOpen} onOpenChange={setQualityDialogOpen} />
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
