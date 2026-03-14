"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function AppearanceSettingsManager() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
        </div>
    }

    const options = [
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
                    {options.map((option) => {
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
            </CardContent>
        </Card>
    )
}
