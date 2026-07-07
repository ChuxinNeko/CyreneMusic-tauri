"use client"

import React, { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { convertFileSrc } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface WallpaperInfo {
    wallpaperType: string
    entryPath: string
    name: string
}

interface WallpaperBackgroundProps {
    className?: string
}

/**
 * Wallpaper Engine 背景组件
 * 通过 iframe 渲染 WE 的 HTML 壁纸
 */
export function WallpaperBackground({ className = "" }: WallpaperBackgroundProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [wallpaperInfo, setWallpaperInfo] = useState<WallpaperInfo | null>(null)
    const [htmlContent, setHtmlContent] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // 获取 Wallpaper Engine 壁纸信息
    useEffect(() => {
        const fetchWallpaper = async () => {
            try {
                const isRunning = await invoke<boolean>("is_wallpaper_engine_running")
                if (!isRunning) {
                    setError("Wallpaper Engine 未运行")
                    setLoading(false)
                    return
                }

                const info = await invoke<WallpaperInfo>("get_wallpaper_engine_background")
                setWallpaperInfo(info)
                setError(null)

                // 如果是 HTML 类型，预加载并注入 shim
                if (info.wallpaperType === "html") {
                    const html = await invoke<string>("get_wallpaper_html_with_shim", {
                        htmlPath: info.entryPath
                    })
                    setHtmlContent(html)
                }
            } catch (err) {
                console.error("[WallpaperBackground] 获取壁纸失败:", err)
                setError(String(err))
            } finally {
                setLoading(false)
            }
        }

        fetchWallpaper()
    }, [])

    // 渲染逻辑
    if (loading) {
        return (
            <div className={`absolute inset-0 bg-black ${className}`}>
                <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
                    加载壁纸引擎背景...
                </div>
            </div>
        )
    }

    if (error || !wallpaperInfo) {
        return (
            <div className={`absolute inset-0 bg-black ${className}`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 text-sm">
                    <span>Wallpaper Engine 背景不可用</span>
                    {error && <span className="text-xs mt-1 opacity-60">{error}</span>}
                </div>
            </div>
        )
    }

    // HTML 壁纸：使用 srcdoc 显示注入 shim 后的内容
    if (wallpaperInfo.wallpaperType === "html" && htmlContent) {
        return (
            <div className={`absolute inset-0 ${className}`}>
                <iframe
                    ref={iframeRef}
                    srcDoc={htmlContent}
                    className="w-full h-full border-0"
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        pointerEvents: "none", // 防止交互干扰播放器
                    }}
                    sandbox="allow-scripts allow-same-origin"
                />
            </div>
        )
    }

    // 视频壁纸：使用 video 标签
    if (wallpaperInfo.wallpaperType === "video") {
        return (
            <div className={`absolute inset-0 ${className}`}>
                <video
                    src={convertFileSrc(wallpaperInfo.entryPath)}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                />
            </div>
        )
    }

    // 图片壁纸
    if (wallpaperInfo.wallpaperType === "image") {
        return (
            <div className={`absolute inset-0 ${className}`}>
                <div
                    className="w-full h-full"
                    style={{
                        backgroundImage: `url(${convertFileSrc(wallpaperInfo.entryPath)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
            </div>
        )
    }

    // 不支持的类型（如 scene）
    return (
        <div className={`absolute inset-0 bg-black ${className}`}>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 text-sm gap-1">
                <span>当前壁纸类型不支持: {wallpaperInfo.wallpaperType}</span>
                <span className="text-xs opacity-60">仅支持 HTML / 视频 / 图片类型壁纸</span>
            </div>
        </div>
    )
}
