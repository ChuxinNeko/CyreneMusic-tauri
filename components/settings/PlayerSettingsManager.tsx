"use client"

import React from "react"
import { Activity, Layers, Languages, Type, Disc, Droplets, Monitor, Baseline, Palette, Box, Move } from "lucide-react"
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core"
import { emit } from "@tauri-apps/api/event"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LyricDisplayStyle, SingleLineAnimation } from "@/lib/store/usePlayerStore"
import { useDesktopPlayerStore } from "@/lib/store/useDesktopPlayerStore"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { LYRIC_FONT_OPTIONS } from "@/lib/constants/fonts"
import { useIsMobile } from "@/hooks/use-mobile"
import { useUIThemeStore } from "@/lib/store/useUIThemeStore"
import { Card as FluentCard, CardHeader as FluentCardHeader, Text, Button as FluentButton } from "@fluentui/react-components"
import { RwuiSwitch } from "@/components/rwui/RwuiSwitch"
import { RwuiSlider } from "@/components/rwui/RwuiSlider"
import { RwuiSelect } from "@/components/rwui/RwuiSelect"

export function PlayerSettingsManager() {
    const isMobile = useIsMobile()

    // ── 桌面播放器独立设置 ──
    const audioVisualization = useDesktopPlayerStore(s => s.audioVisualization)
    const toggleAudioVisualization = useDesktopPlayerStore(s => s.toggleAudioVisualization)
    const isImmersiveMode = useDesktopPlayerStore(s => s.isImmersiveMode)
    const setIsImmersiveMode = useDesktopPlayerStore(s => s.setIsImmersiveMode)
    const showTranslation = useDesktopPlayerStore(s => s.showTranslation)
    const toggleTranslation = useDesktopPlayerStore(s => s.toggleTranslation)

    const lyricDisplayStyle = useDesktopPlayerStore(s => s.lyricDisplayStyle)
    const setLyricDisplayStyle = useDesktopPlayerStore(s => s.setLyricDisplayStyle)
    const singleLineAnimation = useDesktopPlayerStore(s => s.singleLineAnimation)
    const setSingleLineAnimation = useDesktopPlayerStore(s => s.setSingleLineAnimation)

    const lyricFontFamily = useDesktopPlayerStore(s => s.lyricFontFamily)
    const setLyricFontFamily = useDesktopPlayerStore(s => s.setLyricFontFamily)
    const lyricFontSize = useDesktopPlayerStore(s => s.lyricFontSize)
    const setLyricFontSize = useDesktopPlayerStore(s => s.setLyricFontSize)
    const lyricBlurStrength = useDesktopPlayerStore(s => s.lyricBlurStrength)
    const setLyricBlurStrength = useDesktopPlayerStore(s => s.setLyricBlurStrength)

    // 桌面播放器编辑模式 + 偏移量
    const isLyricEditorMode = useDesktopPlayerStore(s => s.isLyricEditorMode)
    const setIsLyricEditorMode = useDesktopPlayerStore(s => s.setIsLyricEditorMode)
    const lyricOffsetX = useDesktopPlayerStore(s => s.lyricOffsetX)
    const setLyricOffsetX = useDesktopPlayerStore(s => s.setLyricOffsetX)
    const lyricOffsetY = useDesktopPlayerStore(s => s.lyricOffsetY)
    const setLyricOffsetY = useDesktopPlayerStore(s => s.setLyricOffsetY)

    // 3D 效果
    const desktopLyricRotationX = useDesktopPlayerStore(s => s.desktopLyricRotationX)
    const setDesktopLyricRotationX = useDesktopPlayerStore(s => s.setDesktopLyricRotationX)
    const desktopLyricRotationY = useDesktopPlayerStore(s => s.desktopLyricRotationY)
    const setDesktopLyricRotationY = useDesktopPlayerStore(s => s.setDesktopLyricRotationY)
    const desktopLyricRotationZ = useDesktopPlayerStore(s => s.desktopLyricRotationZ)
    const setDesktopLyricRotationZ = useDesktopPlayerStore(s => s.setDesktopLyricRotationZ)
    const desktopLyricPerspective = useDesktopPlayerStore(s => s.desktopLyricPerspective)
    const setDesktopLyricPerspective = useDesktopPlayerStore(s => s.setDesktopLyricPerspective)

    // ── 浮动桌面歌词窗口（全局共享） ──
    const desktopLyricFontSize = useFullscreenSettingsStore(s => s.desktopLyricFontSize)
    const desktopLyricColor = useFullscreenSettingsStore(s => s.desktopLyricColor)
    const desktopLyricStrokeColor = useFullscreenSettingsStore(s => s.desktopLyricStrokeColor)
    const setDesktopLyricFontSize = useFullscreenSettingsStore(s => s.setDesktopLyricFontSize)
    const setDesktopLyricColor = useFullscreenSettingsStore(s => s.setDesktopLyricColor)
    const setDesktopLyricStrokeColor = useFullscreenSettingsStore(s => s.setDesktopLyricStrokeColor)

    // 桌面播放器开关
    const isDesktopPlayerOpen = usePlayerStore(s => s.isDesktopPlayerOpen)
    const setIsDesktopPlayerOpen = usePlayerStore(s => s.setIsDesktopPlayerOpen)

    const [mounted, setMounted] = React.useState(false)
    const [isImporting] = React.useState(false)
    const [desktopLyricOpen, setDesktopLyricOpen] = React.useState(false)
    React.useEffect(() => { setMounted(true) }, [])

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

    const toggleDesktopPlayer = async (open: boolean) => {
        setIsDesktopPlayerOpen(open)
        try {
            if (open) {
                await invoke('open_desktop_player')
            } else {
                await invoke('close_desktop_player')
            }
        } catch (error) {
            console.error('Failed to toggle desktop player:', error)
            toast.error("切换桌面播放器失败")
            setIsDesktopPlayerOpen(!open)
        }
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

    const { currentTheme } = useUIThemeStore()
    const isFluent = currentTheme === "fluent"

    const FluentHorizontalCard = ({ icon: Icon, title, description, action }: {
        icon: React.ElementType
        title: string
        description?: string
        action?: React.ReactNode
    }) => {
        const HeaderComponent = FluentCardHeader as any
        return (
        <FluentCard
            orientation="horizontal"
            appearance="subtle"
            className="w-full bg-transparent border border-black/[0.05] dark:border-white/[0.08] shadow-sm rounded-lg transition-colors"
        >
            <HeaderComponent
                image={<Icon className="h-5 w-5 ml-1 mr-2 text-neutral-700 dark:text-neutral-300" />}
                header={<Text className="block truncate font-medium">{title}</Text>}
                description={description ? <Text size={200} className="block truncate text-neutral-500 dark:text-neutral-400">{description}</Text> : undefined}
                action={action}
            />
        </FluentCard>
        )
    }

    if (isFluent) {
        return (
            <div className="flex flex-col gap-8">
                {/* 显示模式 */}
                <section className="space-y-3">
                    <div className="space-y-1">
                        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                            <Layers className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                            显示模式
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">控制桌面播放器的视觉表现</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FluentHorizontalCard
                            icon={Activity}
                            title="音频律动"
                            description="让背景随音频频率动态变化"
                            action={
                                <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                    <RwuiSwitch checked={mounted ? audioVisualization : false} onChange={toggleAudioVisualization} />
                                </div>
                            }
                        />
                        <FluentHorizontalCard
                            icon={Layers}
                            title="沉浸模式"
                            description="用大尺寸封面铺满播放器"
                            action={
                                <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                    <RwuiSwitch checked={mounted ? isImmersiveMode : false} onChange={setIsImmersiveMode} />
                                </div>
                            }
                        />
                        <FluentHorizontalCard
                            icon={Languages}
                            title="显示翻译"
                            description="歌词下方显示翻译行"
                            action={
                                <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                    <RwuiSwitch checked={mounted ? showTranslation : false} onChange={toggleTranslation} />
                                </div>
                            }
                        />
                        <FluentHorizontalCard
                            icon={Move}
                            title="编辑模式"
                            description="允许拖拽歌词面板调整位置"
                            action={
                                <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                    <RwuiSwitch checked={mounted ? isLyricEditorMode : false} onChange={setIsLyricEditorMode} />
                                </div>
                            }
                        />
                    </div>
                </section>

                {/* 歌词样式 */}
                <section className="space-y-3">
                    <div className="space-y-1">
                        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                            <Disc className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                            歌词样式
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">自定义歌词的显示方式</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FluentHorizontalCard
                            icon={Disc}
                            title="歌词样式"
                            description="选择歌词的滚动展示方式"
                            action={
                                <div onClick={(e) => e.stopPropagation()}>
                                    <RwuiSelect
                                        data={lyricStyles.map(s => ({ label: s.label, value: s.value }))}
                                        value={mounted ? lyricDisplayStyle : undefined}
                                        onChange={(v) => setLyricDisplayStyle(v as LyricDisplayStyle)}
                                        style={{ width: 100 }}
                                    />
                                </div>
                            }
                        />
                        {mounted && lyricDisplayStyle === LyricDisplayStyle.SingleLine && (
                            <FluentHorizontalCard
                                icon={Disc}
                                title="单行动画"
                                description="单行歌词模式下的切换动画"
                                action={
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <RwuiSelect
                                            data={singleLineAnims.map(a => ({ label: a.label, value: a.value }))}
                                            value={singleLineAnimation}
                                            onChange={(v) => setSingleLineAnimation(v as SingleLineAnimation)}
                                            style={{ width: 100 }}
                                        />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </section>

                {/* 歌词排版 */}
                <section className="space-y-3">
                    <div className="space-y-1">
                        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                            <Type className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                            歌词排版
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">调整歌词的字体与模糊效果</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FluentHorizontalCard
                            icon={Type}
                            title="歌词字体"
                            description="选择歌词显示的字体"
                            action={
                                <div onClick={(e) => e.stopPropagation()}>
                                    <RwuiSelect
                                        data={LYRIC_FONT_OPTIONS.map(f => ({ label: f.label, value: f.value }))}
                                        value={mounted ? lyricFontFamily : undefined}
                                        onChange={(v) => setLyricFontFamily(v)}
                                        style={{ width: 140 }}
                                    />
                                </div>
                            }
                        />
                        <FluentHorizontalCard
                            icon={Baseline}
                            title="歌词字号"
                            description={`${lyricFontSize}px`}
                            action={
                                <RwuiSlider
                                    value={lyricFontSize}
                                    min={20}
                                    max={60}
                                    step={1}
                                    onChange={setLyricFontSize}
                                    width={180}
                                    showPopupValue={false}
                                />
                            }
                        />
                        <FluentHorizontalCard
                            icon={Droplets}
                            title="背景模糊"
                            description={`${lyricBlurStrength}px`}
                            action={
                                <RwuiSlider
                                    value={lyricBlurStrength}
                                    min={0}
                                    max={20}
                                    step={1}
                                    onChange={setLyricBlurStrength}
                                    width={180}
                                    showPopupValue={false}
                                />
                            }
                        />
                    </div>
                </section>

                {/* 3D 效果 */}
                <section className="space-y-3">
                    <div className="space-y-1">
                        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                            <Box className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                            3D 效果
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">调整歌词面板的 3D 旋转与透视</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FluentHorizontalCard
                            icon={Box}
                            title="X轴旋转"
                            description={`${desktopLyricRotationX}°`}
                            action={
                                <RwuiSlider
                                    value={desktopLyricRotationX}
                                    min={-90}
                                    max={90}
                                    step={1}
                                    onChange={setDesktopLyricRotationX}
                                    width={180}
                                    showPopupValue={false}
                                />
                            }
                        />
                        <FluentHorizontalCard
                            icon={Box}
                            title="Y轴旋转"
                            description={`${desktopLyricRotationY}°`}
                            action={
                                <RwuiSlider
                                    value={desktopLyricRotationY}
                                    min={-90}
                                    max={90}
                                    step={1}
                                    onChange={setDesktopLyricRotationY}
                                    width={180}
                                    showPopupValue={false}
                                />
                            }
                        />
                        <FluentHorizontalCard
                            icon={Box}
                            title="Z轴旋转"
                            description={`${desktopLyricRotationZ}°`}
                            action={
                                <RwuiSlider
                                    value={desktopLyricRotationZ}
                                    min={-180}
                                    max={180}
                                    step={1}
                                    onChange={setDesktopLyricRotationZ}
                                    width={180}
                                    showPopupValue={false}
                                />
                            }
                        />
                        <FluentHorizontalCard
                            icon={Box}
                            title="3D视距"
                            description={`${desktopLyricPerspective}px`}
                            action={
                                <RwuiSlider
                                    value={desktopLyricPerspective}
                                    min={200}
                                    max={3000}
                                    step={50}
                                    onChange={setDesktopLyricPerspective}
                                    width={180}
                                    showPopupValue={false}
                                />
                            }
                        />
                    </div>
                </section>

                {/* 桌面歌词 + 桌面播放器（仅桌面端） */}
                {mounted && !isMobile && (
                    <section className="space-y-3">
                        <div className="space-y-1">
                            <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                                <Monitor className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                                桌面歌词窗口
                            </h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">设置桌面悬浮歌词窗口与桌面播放器</p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FluentHorizontalCard
                                icon={Monitor}
                                title="桌面歌词"
                                description="在桌面上显示悬浮歌词"
                                action={
                                    <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                        <RwuiSwitch checked={desktopLyricOpen} onChange={async (v) => { setDesktopLyricOpen(v); if (v) { openDesktopLyric() } else { try { await invoke('close_desktop_lyric') } catch (e) { console.error('Failed to close desktop lyric:', e) } } }} />
                                    </div>
                                }
                            />
                            <FluentHorizontalCard
                                icon={Monitor}
                                title="桌面播放器"
                                description="在桌面上显示播放器和歌词"
                                action={
                                    <div className="rwui-scope" data-theme={document.documentElement.getAttribute("data-theme")}>
                                        <RwuiSwitch checked={isDesktopPlayerOpen} onChange={toggleDesktopPlayer} />
                                    </div>
                                }
                            />
                            <FluentHorizontalCard
                                icon={Baseline}
                                title="桌面歌词字号"
                                description={`${desktopLyricFontSize}px`}
                                action={
                                    <RwuiSlider
                                        value={desktopLyricFontSize}
                                        min={20}
                                        max={80}
                                        step={1}
                                        onChange={(v) => { setDesktopLyricFontSize(v); syncDesktopSettings({ desktopLyricFontSize: v }) }}
                                        width={180}
                                        showPopupValue={false}
                                    />
                                }
                            />
                            <FluentHorizontalCard
                                icon={Palette}
                                title="桌面歌词颜色"
                                description={desktopLyricColor}
                                action={
                                    <input
                                        type="color"
                                        value={desktopLyricColor}
                                        className="w-8 h-8 p-0 border border-black/[0.05] dark:border-white/[0.08] rounded cursor-pointer bg-transparent"
                                        onChange={(e) => { setDesktopLyricColor(e.target.value); syncDesktopSettings({ desktopLyricColor: e.target.value }) }}
                                    />
                                }
                            />
                            <FluentHorizontalCard
                                icon={Palette}
                                title="桌面歌词描边"
                                description={desktopLyricStrokeColor}
                                action={
                                    <input
                                        type="color"
                                        value={desktopLyricStrokeColor}
                                        className="w-8 h-8 p-0 border border-black/[0.05] dark:border-white/[0.08] rounded cursor-pointer bg-transparent"
                                        onChange={(e) => { setDesktopLyricStrokeColor(e.target.value); syncDesktopSettings({ desktopLyricStrokeColor: e.target.value }) }}
                                    />
                                }
                            />
                        </div>
                    </section>
                )}
            </div>
        )
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle>桌面播放器设置</CardTitle>
                <CardDescription>自定义桌面播放器的歌词、字体、3D 效果与桌面歌词窗口，偏好会自动保存在此设备。全屏播放器设置请通过其左上角菜单调整。</CardDescription>
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
                        <SwitchRow
                            title="编辑模式"
                            description="允许拖拽歌词面板调整位置"
                            checked={mounted ? isLyricEditorMode : false}
                            onCheckedChange={setIsLyricEditorMode}
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

                {/* 区块 D · 3D 效果 */}
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold flex items-center gap-2"><Box className="h-4 w-4" /> 3D 效果</h3>
                    </div>
                    <div className="space-y-4 rounded-xl border p-4">
                        <SliderRow label="X轴旋转 (前后倾斜)" value={desktopLyricRotationX} min={-90} max={90} step={1} unit="°" onChange={setDesktopLyricRotationX} />
                        <SliderRow label="Y轴旋转 (左右倾斜)" value={desktopLyricRotationY} min={-90} max={90} step={1} unit="°" onChange={setDesktopLyricRotationY} />
                        <SliderRow label="Z轴旋转 (平面旋转)" value={desktopLyricRotationZ} min={-180} max={180} step={1} unit="°" onChange={setDesktopLyricRotationZ} />
                        <SliderRow label="3D视距 (透视)" value={desktopLyricPerspective} min={200} max={3000} step={50} unit="px" onChange={setDesktopLyricPerspective} />
                    </div>
                </section>

                {/* 区块 E · 桌面歌词窗口（仅桌面端） */}
                {mounted && !isMobile && (
                    <section className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold flex items-center gap-2"><Monitor className="h-4 w-4" /> 桌面歌词窗口</h3>
                        </div>
                        <div className="space-y-4 rounded-xl border p-4">
                            <Button variant="outline" size="sm" onClick={openDesktopLyric}>
                                <Monitor className="h-4 w-4 mr-2" />
                                打开桌面歌词窗口
                            </Button>
                            <SwitchRow
                                title="桌面播放器"
                                description="在桌面上显示播放器和歌词"
                                checked={isDesktopPlayerOpen}
                                onCheckedChange={toggleDesktopPlayer}
                            />
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