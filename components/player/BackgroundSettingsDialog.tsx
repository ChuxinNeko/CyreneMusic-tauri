"use client"

import React from "react"
import { ImagePlus, Loader2, Monitor } from "lucide-react"
import { toast } from "sonner"
import { convertFileSrc } from "@tauri-apps/api/core"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { useFullscreenSettingsStore, FullscreenSettingsState } from "@/lib/store/useFullscreenSettingsStore"
import { PlayerBgType } from "@/lib/store/usePlayerStore"
import { backgroundService } from "@/lib/services/backgroundService"
import { invoke } from "@tauri-apps/api/core"

interface BackgroundSettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function BackgroundSettingsDialog({ open, onOpenChange }: BackgroundSettingsDialogProps) {
    const playerBgType = useFullscreenSettingsStore(s => s.playerBgType)
    const setPlayerBgType = useFullscreenSettingsStore(s => s.setPlayerBgType)
    const customBgPath = useFullscreenSettingsStore(s => s.customBgPath)
    const setCustomBgPath = useFullscreenSettingsStore(s => s.setCustomBgPath)
    const customBgBlur = useFullscreenSettingsStore(s => s.customBgBlur)
    const setCustomBgBlur = useFullscreenSettingsStore(s => s.setCustomBgBlur)
    const customBgBrightness = useFullscreenSettingsStore(s => s.customBgBrightness)
    const setCustomBgBrightness = useFullscreenSettingsStore(s => s.setCustomBgBrightness)
    const customBgScale = useFullscreenSettingsStore(s => s.customBgScale)
    const setCustomBgScale = useFullscreenSettingsStore(s => s.setCustomBgScale)
    const customBgOverlay = useFullscreenSettingsStore(s => s.customBgOverlay)
    const setCustomBgOverlay = useFullscreenSettingsStore(s => s.setCustomBgOverlay)

    const [isImporting, setIsImporting] = React.useState(false)
    const [mounted, setMounted] = React.useState(false)

    // 规避 SSR/localStorage 水合不匹配
    React.useEffect(() => { setMounted(true) }, [])

    const customBgUrl = customBgPath ? convertFileSrc(customBgPath) : null

    const handleSelectImage = async () => {
        if (isImporting) return
        setIsImporting(true)
        try {
            const { open } = await import("@tauri-apps/plugin-dialog")
            const selected = await open({
                directory: false,
                multiple: false,
                title: "选择背景图片",
                filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
            })
            if (selected === null) {
                setIsImporting(false)
                return
            }
            const sourcePath = Array.isArray(selected) ? selected[0] : selected
            if (!sourcePath) {
                setIsImporting(false)
                return
            }

            const savedPath = await backgroundService.saveBackground(sourcePath)
            setCustomBgPath(savedPath)
            setPlayerBgType("image")
            toast.success("背景图片已应用")
        } catch (error) {
            console.error("[BackgroundSettings] 导入背景失败:", error)
            toast.error("导入背景图片失败")
        } finally {
            setIsImporting(false)
        }
    }

    const handleSwitchType = (type: PlayerBgType) => {
        // 切到图片但没有图：引导选择
        if (type === "image" && !customBgPath) {
            handleSelectImage()
            return
        }
        // 切到壁纸选项时检查 WE 是否运行
        if (type === "wallpaper") {
            handleSelectWallpaper()
            return
        }
        setPlayerBgType(type)
    }

    const handleSelectWallpaper = async () => {
        try {
            const isRunning = await invoke<boolean>("is_wallpaper_engine_running")
            if (!isRunning) {
                toast.error("Wallpaper Engine 未运行，请先启动 WE")
                return
            }
            setPlayerBgType("wallpaper")
            toast.success("已切换到 Wallpaper Engine 背景")
        } catch (error) {
            console.error("[BackgroundSettings] 检查 WE 状态失败:", error)
            toast.error("检查 Wallpaper Engine 状态失败")
        }
    }

    const bgOptions: { label: string; value: PlayerBgType; icon?: React.ReactNode }[] = [
        { label: "默认动态背景", value: "webgl" },
        { label: "自定义图片", value: "image" },
        { label: "WE 壁纸", value: "wallpaper", icon: <Monitor className="h-3 w-3 inline mr-1" /> },
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>播放器背景</DialogTitle>
                    <DialogDescription className="text-white/50">
                        选择全屏播放器的背景样式
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* 类型切换 */}
                    <div className="grid grid-cols-3 gap-2">
                        {bgOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleSwitchType(opt.value)}
                                className={`text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                                    mounted && playerBgType === opt.value
                                        ? "bg-white/20 text-white"
                                        : "bg-white/5 text-white/60 hover:bg-white/10"
                                }`}
                            >
                                {opt.icon}
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* 自定义图片参数（仅在 image 模式显示） */}
                    {mounted && playerBgType === "image" && (
                        <div className="space-y-4">
                            {/* 当前预览 + 选择按钮 */}
                            <div className="flex items-center gap-3">
                                <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 relative">
                                    {customBgUrl ? (
                                        <img
                                            src={customBgUrl}
                                            alt="背景预览"
                                            className="w-full h-full object-cover"
                                            style={{
                                                filter: `blur(${customBgBlur}px) brightness(${customBgBrightness}%)`,
                                                transform: `scale(${customBgScale / 100})`,
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                                            无图片
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleSelectImage}
                                    disabled={isImporting}
                                    className="flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                                >
                                    {isImporting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ImagePlus className="h-4 w-4" />
                                    )}
                                    {customBgPath ? "更换图片" : "选择图片"}
                                </button>
                            </div>

                            {/* 模糊度 */}
                            <SliderRow
                                label="模糊度"
                                value={customBgBlur}
                                min={0}
                                max={40}
                                step={1}
                                unit="px"
                                onChange={setCustomBgBlur}
                            />

                            {/* 亮度 */}
                            <SliderRow
                                label="亮度"
                                value={customBgBrightness}
                                min={20}
                                max={100}
                                step={1}
                                unit="%"
                                onChange={setCustomBgBrightness}
                            />

                            {/* 缩放 */}
                            <SliderRow
                                label="缩放"
                                value={customBgScale}
                                min={100}
                                max={130}
                                step={1}
                                unit="%"
                                onChange={setCustomBgScale}
                            />

                            {/* 遮罩透明度 */}
                            <SliderRow
                                label="遮罩"
                                value={customBgOverlay}
                                min={0}
                                max={80}
                                step={1}
                                unit="%"
                                onChange={setCustomBgOverlay}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface SliderRowProps {
    label: string
    value: number
    min: number
    max: number
    step: number
    unit: string
    onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-2">
                <span className="opacity-80">{label}</span>
                <span className="opacity-50 tabular-nums">{value}{unit}</span>
            </div>
            <Slider
                value={[value]}
                min={min}
                max={max}
                step={step}
                onValueChange={(v) => onChange(v[0])}
                className="w-full"
            />
        </div>
    )
}
