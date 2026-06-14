"use client"

import React from "react"
import { Music2, Activity, Layers, Languages, Type, Disc, Droplets, Monitor, Baseline, Palette, ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core"
import { emit } from "@tauri-apps/api/event"
import { convertFileSrc } from "@tauri-apps/api/core"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePlayerStore, LyricDisplayStyle, SingleLineAnimation, PlayerBgType } from "@/lib/store/usePlayerStore"
import { LYRIC_FONT_OPTIONS } from "@/lib/constants/fonts"
import { backgroundService } from "@/lib/services/backgroundService"
import { useIsMobile } from "@/hooks/use-mobile"

export function PlayerSettingsManager() {
    const isMobile = useIsMobile()

    // 显示模式
    const audioVisualization = usePlayerStore(s => s.audioVisualization)
    const toggleAudioVisualization = usePlayerStore(s => s.toggleAudioVisualization)
    const isImmersiveMode = usePlayerStore(s => s.isImmersiveMode)
    const setIsImmersiveMode = usePlayerStore(s => s.setIsImmersiveMode)
    const showTranslation = usePlayerStore(s => s.showTranslation)
    const toggleTranslation = usePlayerStore(s => s.toggleTranslation)

    // 歌词样式
    const lyricDisplayStyle = usePlayerStore(s => s.lyricDisplayStyle)
    const setLyricDisplayStyle = usePlayerStore(s => s.setLyricDisplayStyle)
    const singleLineAnimation = usePlayerStore(s => s.singleLineAnimation)
    const setSingleLineAnimation = usePlayerStore(s => s.setSingleLineAnimation)

    // 歌词排版
    const lyricFontFamily = usePlayerStore(s => s.lyricFontFamily)
    const setLyricFontFamily = usePlayerStore(s => s.setLyricFontFamily)
    const lyricFontSize = usePlayerStore(s => s.lyricFontSize)
    const setLyricFontSize = usePlayerStore(s => s.setLyricFontSize)
    const lyricBlurStrength = usePlayerStore(s => s.lyricBlurStrength)
    const setLyricBlurStrength = usePlayerStore(s => s.setLyricBlurStrength)

    // 桌面歌词
    const desktopLyricFontSize = usePlayerStore(s => s.desktopLyricFontSize)
    const desktopLyricColor = usePlayerStore(s => s.desktopLyricColor)
    const desktopLyricStrokeColor = usePlayerStore(s => s.desktopLyricStrokeColor)
    const setDesktopLyricFontSize = usePlayerStore(s => s.setDesktopLyricFontSize)
    const setDesktopLyricColor = usePlayerStore(s => s.setDesktopLyricColor)
    const setDesktopLyricStrokeColor = usePlayerStore(s => s.setDesktopLyricStrokeColor)

    // 自定义背景
    const playerBgType = usePlayerStore(s => s.playerBgType)
    const setPlayerBgType = usePlayerStore(s => s.setPlayerBgType)
    const customBgPath = usePlayerStore(s => s.customBgPath)
    const setCustomBgPath = usePlayerStore(s => s.setCustomBgPath)
    const customBgBlur = usePlayerStore(s => s.customBgBlur)
    const setCustomBgBlur = usePlayerStore(s => s.setCustomBgBlur)
    const customBgBrightness = usePlayerStore(s => s.customBgBrightness)
    const setCustomBgBrightness = usePlayerStore(s => s.setCustomBgBrightness)
    const customBgScale = usePlayerStore(s => s.customBgScale)
    const setCustomBgScale = usePlayerStore(s => s.setCustomBgScale)
    const customBgOverlay = usePlayerStore(s => s.customBgOverlay)
    const setCustomBgOverlay = usePlayerStore(s => s.setCustomBgOverlay)

    const [mounted, setMounted] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    React.useEffect(() => { setMounted(true) }, [])

    const customBgUrl = customBgPath ? convertFileSrc(customBgPath) : null

    // 桌面歌词跨窗口同步（复制自 FullscreenPlayer）
    const syncDesktopSettings = (overrides: Partial<any> = {}) => {
        emit('player:settings-sync', {
            desktopLyricFontSize: overrides.desktopLyricFontSize || desktopLyricFontSize,
            desktopLyricColor: overrides.desktopLyricColor || desktopLyricColor,
            desktopLyricStrokeColor: overrides.desktopLyricStrokeColor || desktopLyricStrokeColor,
            ...overrides,
        })
    }

    const openDesktopLyric = async () => {
        try {
            await invoke('open_desktop_lyric')
        } catch (error) {
            console.error('Failed to open desktop lyric:', error)
            toast.error("打开桌面歌词失败")
        }
    }

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
            console.error("[PlayerSettings] 导入背景失败:", error)
            toast.error("导入背景图片失败")
        } finally {
            setIsImporting(false)
        }
    }

    const handleSwitchBgType = (type: PlayerBgType) => {
        if (type === "image" && !customBgPath) {
            handleSelectImage()
            return
        }
        setPlayerBgType(type)
    }

    const lyricStyles: { label: string; value: LyricDisplayStyle }[] = [
        { label: "滚动", value: LyricDisplayStyle.Scroll },
        { label: "轮盘", value: LyricDisplayStyle.Roulette },
        { label: "单行", value: LyricDisplayStyle.SingleLine },
    ]

    const singleLineAnims: { label: string; value: SingleLineAnimation }[] = [
        { label: "上推", value: SingleLineAnimation.SlideUp },
        { label: "渐变", value: SingleLineAnimation.Fade },
        { label: "缩放", value: SingleLineAnimation.Zoom },
        { label: "模糊", value: SingleLineAnimation.Blur },
    ]

    const bgTypes: { label: string; value: PlayerBgType }[] = [
        { label: "默认动态背景", value: "webgl" },
        { label: "自定义图片", value: "image" },
    ]

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle>播放器设置</CardTitle>
                <CardDescription>自定义全屏播放器的歌词、字体、背景与桌面歌词，偏好会自动保存在此设备。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 px-0">
                {/* 区块 A · 显示模式 */}
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold flex items-center gap-2"><Layers className="h-4 w-4" /> 显示模式</h3>
                    </div>
                    <div className="space-y-3 rounded-xl border p-4">
                        <SwitchRow
                            title="音频律动"
                            description="让背景随音频频率动态变化"
                            checked={mounted ? audioVisualization : false}
                            onCheckedChange={toggleAudioVisualization}
                        />
                        <SwitchRow
                            title="沉浸模式"
                            description="用大尺寸封面铺满播放器"
                            checked={mounted ? isImmersiveMode : false}
                            onCheckedChange={setIsImmersiveMode}
                        />
                        <SwitchRow
                            title="显示翻译"
                            description="歌词下方显示翻译行"
                            checked={mounted ? showTranslation : false}
                            onCheckedChange={toggleTranslation}
                        />
                    </div>
                </section>

                {/* 区块 B · 歌词样式 */}
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold flex items-center gap-2"><Disc className="h-4 w-4" /> 歌词样式</h3>
                    </div>
                    <div className="space-y-4 rounded-xl border p-4">
                        <div>
                            <p className="text-sm mb-2">歌词样式</p>
                            <div className="flex gap-2">
                                {lyricStyles.map(s => (
                                    <button
                                        key={s.value}
                                        onClick={() => setLyricDisplayStyle(s.value)}
                                        className={cn(
                                            "flex-1 text-xs py-1.5 px-2 rounded-lg transition-colors",
                                            mounted && lyricDisplayStyle === s.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {mounted && lyricDisplayStyle === LyricDisplayStyle.SingleLine && (
                            <div>
                                <p className="text-sm mb-2">单行动画</p>
                                <div className="flex gap-2">
                                    {singleLineAnims.map(a => (
                                        <button
                                            key={a.value}
                                            onClick={() => setSingleLineAnimation(a.value)}
                                            className={cn(
                                                "flex-1 text-xs py-1.5 px-1 rounded-lg transition-colors",
                                                singleLineAnimation === a.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                            )}
                                        >
                                            {a.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* 区块 C · 歌词排版 */}
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold flex items-center gap-2"><Type className="h-4 w-4" /> 歌词排版</h3>
                    </div>
                    <div className="space-y-4 rounded-xl border p-4">
                        <div>
                            <p className="text-sm mb-2">歌词字体</p>
                            <select
                                value={mounted ? lyricFontFamily : LYRIC_FONT_OPTIONS[0].value}
                                onChange={(e) => setLyricFontFamily(e.target.value)}
                                className="w-full bg-background border rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
                            >
                                {LYRIC_FONT_OPTIONS.map(f => (
                                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <SliderRow label="歌词字号" value={lyricFontSize} min={20} max={60} step={1} unit="px" onChange={setLyricFontSize} />
                        <SliderRow label="背景模糊" value={lyricBlurStrength} min={0} max={20} step={1} unit="px" onChange={setLyricBlurStrength} />
                    </div>
                </section>

                {/* 区块 D · 自定义播放器背景 */}
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold flex items-center gap-2"><ImagePlus className="h-4 w-4" /> 播放器背景</h3>
                    </div>
                    <div className="space-y-4 rounded-xl border p-4">
                        <div>
                            <p className="text-sm mb-2">背景类型</p>
                            <div className="grid grid-cols-2 gap-2">
                                {bgTypes.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => handleSwitchBgType(t.value)}
                                        className={cn(
                                            "text-sm py-2 px-3 rounded-lg transition-colors",
                                            mounted && playerBgType === t.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                        )}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {mounted && playerBgType === "image" && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted border shrink-0 relative">
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
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                                无图片
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleSelectImage} disabled={isImporting}>
                                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                                        {customBgPath ? "更换图片" : "选择图片"}
                                    </Button>
                                </div>
                                <SliderRow label="模糊度" value={customBgBlur} min={0} max={40} step={1} unit="px" onChange={setCustomBgBlur} />
                                <SliderRow label="亮度" value={customBgBrightness} min={20} max={100} step={1} unit="%" onChange={setCustomBgBrightness} />
                                <SliderRow label="缩放" value={customBgScale} min={100} max={130} step={1} unit="%" onChange={setCustomBgScale} />
                                <SliderRow label="遮罩" value={customBgOverlay} min={0} max={80} step={1} unit="%" onChange={setCustomBgOverlay} />
                            </div>
                        )}
                    </div>
                </section>

                {/* 区块 E · 桌面歌词（仅桌面端） */}
                {mounted && !isMobile && (
                    <section className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold flex items-center gap-2"><Monitor className="h-4 w-4" /> 桌面歌词</h3>
                        </div>
                        <div className="space-y-4 rounded-xl border p-4">
                            <Button variant="outline" size="sm" onClick={openDesktopLyric}>
                                <Monitor className="h-4 w-4 mr-2" />
                                打开桌面歌词窗口
                            </Button>
                            <SliderRow
                                label="桌面歌词字号"
                                value={desktopLyricFontSize}
                                min={20}
                                max={80}
                                step={1}
                                unit="px"
                                onChange={(v) => { setDesktopLyricFontSize(v); syncDesktopSettings({ desktopLyricFontSize: v }) }}
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <Baseline className="h-4 w-4" /> 桌面歌词颜色
                                </div>
                                <input
                                    type="color"
                                    value={desktopLyricColor}
                                    className="w-8 h-8 p-0 border rounded cursor-pointer bg-transparent"
                                    onChange={(e) => { setDesktopLyricColor(e.target.value); syncDesktopSettings({ desktopLyricColor: e.target.value }) }}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <Palette className="h-4 w-4" /> 桌面歌词描边
                                </div>
                                <input
                                    type="color"
                                    value={desktopLyricStrokeColor}
                                    className="w-8 h-8 p-0 border rounded cursor-pointer bg-transparent"
                                    onChange={(e) => { setDesktopLyricStrokeColor(e.target.value); syncDesktopSettings({ desktopLyricStrokeColor: e.target.value }) }}
                                />
                            </div>
                        </div>
                    </section>
                )}
            </CardContent>
        </Card>
    )
}

interface SwitchRowProps {
    title: string
    description: string
    checked: boolean
    onCheckedChange: (v: boolean) => void
}

function SwitchRow({ title, description, checked, onCheckedChange }: SwitchRowProps) {
    return (
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <h4 className="text-sm font-medium">{title}</h4>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
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
                <span>{label}</span>
                <span className="text-muted-foreground tabular-nums">{value}{unit}</span>
            </div>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} className="w-full" />
        </div>
    )
}
