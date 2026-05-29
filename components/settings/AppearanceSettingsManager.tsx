"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Monitor, Moon, Sun, Layers, Square, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
    useWindowMaterialStore,
    WindowMaterial,
    fetchSystemMaterialSupport,
    applyWindowMaterial,
} from "@/lib/store/useWindowMaterialStore"
import { Switch } from "@/components/ui/switch"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { emit } from "@tauri-apps/api/event"

export function AppearanceSettingsManager() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [isDesktop, setIsDesktop] = useState(false)
    const { material, systemSupport, setMaterial, setSystemSupport } = useWindowMaterialStore()
    const { isTaskbarPlayerEnabled, setTaskbarPlayerEnabled } = useLayoutStore()

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
        // 桌面端检测: 宽度 >= 768px 且非触屏优先设备
        setIsDesktop(window.innerWidth >= 768)
    }, [])

    // 在组件挂载时获取系统支持信息
    useEffect(() => {
        if (!mounted) return
        const loadSupport = async () => {
            const support = await fetchSystemMaterialSupport()
            setSystemSupport(support)
        }
        loadSupport()
    }, [mounted, setSystemSupport])

    if (!mounted) {
        return <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
        </div>
    }

    const themeOptions = [
        {
            id: "system",
            name: "跟随系统",
            description: "根据系统设置自动切换浅色或深色",
            icon: Monitor,
            color: "text-primary"
        },
        {
            id: "light",
            name: "浅色模式",
            description: "清爽明亮的外观风格",
            icon: Sun,
            color: "text-amber-500"
        },
        {
            id: "dark",
            name: "深色模式",
            description: "降低屏幕亮度，护眼夜间体验",
            icon: Moon,
            color: "text-indigo-400"
        }
    ]

    const materialOptions: {
        id: WindowMaterial
        name: string
        description: string
        icon: typeof Square
        color: string
        supported: boolean
        unsupportedHint: string
    }[] = [
        {
            id: "opaque",
            name: "默认不透明",
            description: "纯色背景，兼容性最佳",
            icon: Square,
            color: "text-slate-500",
            supported: true,
            unsupportedHint: "",
        },
        {
            id: "mica",
            name: "云母材质",
            description: "Windows 11 原生毛玻璃效果",
            icon: Layers,
            color: "text-sky-500",
            supported: systemSupport.isMicaSupported,
            unsupportedHint: "需要 Windows 11 才能使用",
        },
        {
            id: "acrylic",
            name: "亚克力材质",
            description: "半透明高斯模糊背景效果",
            icon: Sparkles,
            color: "text-violet-500",
            supported: systemSupport.isAcrylicSupported,
            unsupportedHint: "需要 Windows 10 1809 或更高版本",
        },
    ]

    const handleMaterialChange = async (newMaterial: WindowMaterial) => {
        setMaterial(newMaterial)
        await applyWindowMaterial(newMaterial)
    }

    const handleTaskbarPlayerChange = async (checked: boolean) => {
        setTaskbarPlayerEnabled(checked)
        if (checked) {
            emit('player:command', 'open-taskbar-player')
        } else {
            emit('player:command', 'close-taskbar-player')
        }
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle>外观与主题</CardTitle>
                <CardDescription>
                    自定义应用的配色风格，您的偏好将会被自动保存在此设备中。
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {themeOptions.map((option) => {
                        const isSelected = theme === option.id
                        const Icon = option.icon

                        return (
                            <Label
                                key={option.id}
                                htmlFor={option.id}
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all hover:bg-accent",
                                    isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-muted bg-popover"
                                )}
                                onClick={() => setTheme(option.id)}
                            >
                                <div className="mb-4 p-3 rounded-full bg-background shadow-sm border">
                                    <Icon className={cn("h-6 w-6", option.color)} />
                                </div>
                                <div className="space-y-1 text-center">
                                    <div className="font-semibold text-base">{option.name}</div>
                                    <div className="text-xs text-muted-foreground line-clamp-2">
                                        {option.description}
                                    </div>
                                </div>
                            </Label>
                        )
                    })}
                </div>

                {/* 窗口材质选择 - 仅桌面端显示 */}
                {isDesktop && (
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold">窗口材质</h3>
                            <p className="text-sm text-muted-foreground">
                                更改窗口的透明度与材质效果，部分选项需要系统支持。
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {materialOptions.map((option) => {
                                const isSelected = material === option.id
                                const Icon = option.icon
                                const disabled = !option.supported

                                return (
                                    <Label
                                        key={option.id}
                                        htmlFor={`material-${option.id}`}
                                        className={cn(
                                            "flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all",
                                            disabled
                                                ? "opacity-40 cursor-not-allowed border-muted bg-muted/30"
                                                : "cursor-pointer hover:bg-accent",
                                            isSelected && !disabled
                                                ? "border-primary bg-primary/5"
                                                : !disabled
                                                    ? "border-muted bg-popover"
                                                    : ""
                                        )}
                                        onClick={() => {
                                            if (!disabled) handleMaterialChange(option.id)
                                        }}
                                    >
                                        <div className={cn(
                                            "mb-4 p-3 rounded-full bg-background shadow-sm border",
                                            disabled && "opacity-50"
                                        )}>
                                            <Icon className={cn("h-6 w-6", disabled ? "text-muted-foreground" : option.color)} />
                                        </div>
                                        <div className="space-y-1 text-center">
                                            <div className={cn("font-semibold text-base", disabled && "text-muted-foreground")}>
                                                {option.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground line-clamp-2">
                                                {disabled ? option.unsupportedHint : option.description}
                                            </div>
                                        </div>
                                    </Label>
                                )
                            })}
                        </div>
                    </div>
                )}

                {isDesktop && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold">任务栏播放器</h3>
                                <p className="text-sm text-muted-foreground">
                                    在 Windows 任务栏显示微型播放控件（悬浮窗）。
                                </p>
                            </div>
                            <Switch 
                                checked={isTaskbarPlayerEnabled}
                                onCheckedChange={handleTaskbarPlayerChange}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

