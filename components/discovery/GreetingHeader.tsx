"use client"

import { useEffect, useState } from "react"
import { Sun, Moon, Cloud, Sunrise, Sunset } from "lucide-react"

export function GreetingHeader() {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const getGreeting = () => {
        const hour = currentTime.getHours()
        // 06:00 - 18:00 使用指定的 Iconify 图标
        const isDaytime = hour >= 6 && hour < 18
        const dayIcon = "icon-[fluent-emoji-flat--sun-behind-small-cloud]"

        if (hour < 6) return { text: "夜深了", sub: "注意休息，音乐轻声一点", icon: Moon, type: 'lucide' }
        if (hour < 9) return { text: "早上好", sub: "新的一天，从此开始好心情", icon: dayIcon, type: 'iconify' }
        if (hour < 12) return { text: "上午好", sub: "愿音乐伴你高效工作", icon: dayIcon, type: 'iconify' }
        if (hour < 14) return { text: "中午好", sub: "午后小憩，来点轻松的旋律", icon: dayIcon, type: 'iconify' }
        if (hour < 18) return { text: "下午好", sub: "忙碌之余，听听喜欢的歌", icon: dayIcon, type: 'iconify' }
        return { text: "晚上好", sub: "夜色温柔，音乐更动听", icon: Moon, type: 'lucide' }
    }

    const { text, sub, icon, type } = getGreeting()

    return (
        <div className="flex items-center gap-4 py-6 animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                {type === 'lucide' ? (
                    <span className="flex items-center justify-center">
                        {(() => {
                            const Icon = icon as any
                            return <Icon className="h-8 w-8" />
                        })()}
                    </span>
                ) : (
                    <span className={`h-8 w-8 block ${icon}`} />
                )}
            </div>
            <div className="space-y-1">
                <h2 className="text-3xl font-black tracking-tighter">{text}</h2>
                <p className="text-sm text-muted-foreground font-medium">{sub}</p>
            </div>
        </div>
    )
}
