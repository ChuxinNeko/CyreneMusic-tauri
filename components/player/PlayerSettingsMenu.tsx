"use client"

import React, { useState } from "react"
import {
    Activity,
    Monitor,
    Sparkles,
    Disc,
    Type,
    Droplets,
    Baseline,
    Palette,
    MoreHorizontal,
    Box,
    Image as ImageIcon,
    Move
} from "lucide-react"
import { usePlayerStore, LyricDisplayStyle, SingleLineAnimation } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { useDesktopPlayerStore } from "@/lib/store/useDesktopPlayerStore"
import { useLyricSettings, LyricScope } from "./LyricSettingsContext"
import { heartModeService } from "@/lib/services/heartModeService"
import { LYRIC_FONT_OPTIONS } from "@/lib/constants/fonts"
import { BackgroundSettingsDialog } from "./BackgroundSettingsDialog"
import { DesktopLyricEffectDialog } from "./DesktopLyricEffectDialog"
import { Slider } from "@/components/ui/slider"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { invoke } from "@tauri-apps/api/core"
import { emit } from "@tauri-apps/api/event"
import { toast } from "sonner"

export interface PlayerSettingsMenuProps {
    triggerIcon?: React.ReactNode
    align?: "start" | "end" | "center"
    /** 设置作用域：fullscreen=全屏播放器，desktop=桌面播放器 */
    scope?: LyricScope
    /** 移动端模式（隐藏部分仅桌面端可用的项） */
    isMobile?: boolean
}

export function PlayerSettingsMenu({ triggerIcon, align = "start", scope = "fullscreen", isMobile = false }: PlayerSettingsMenuProps) {
    // ── 作用域歌词设置（字号/字体/模糊/样式/动画/隐藏封面/翻译/律动/沉浸） ──
    const {
        audioVisualization, toggleAudioVisualization,
        isImmersiveMode, setIsImmersiveMode,
        hideAlbumCover, setHideAlbumCover,
        lyricDisplayStyle, setLyricDisplayStyle,
        singleLineAnimation, setSingleLineAnimation,
        lyricFontFamily, setLyricFontFamily,
        lyricFontSize, setLyricFontSize,
        lyricBlurStrength, setLyricBlurStrength,
    } = useLyricSettings()

    // ── 全局共享状态（播放曲目/心动模式/浮动桌面歌词） ──
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const heartMode = usePlayerStore(s => s.heartMode)
    const setHeartMode = usePlayerStore(s => s.setHeartMode)
    const sourcePlaylistId = usePlayerStore(s => s.sourcePlaylistId)

    // 浮动桌面歌词窗口设置（与 /desktop-lyric 同步）
    const desktopLyricFontSize = useFullscreenSettingsStore(s => s.desktopLyricFontSize)
    const setDesktopLyricFontSize = useFullscreenSettingsStore(s => s.setDesktopLyricFontSize)
    const desktopLyricColor = useFullscreenSettingsStore(s => s.desktopLyricColor)
    const setDesktopLyricColor = useFullscreenSettingsStore(s => s.setDesktopLyricColor)
    const desktopLyricStrokeColor = useFullscreenSettingsStore(s => s.desktopLyricStrokeColor)
    const setDesktopLyricStrokeColor = useFullscreenSettingsStore(s => s.setDesktopLyricStrokeColor)

    // ── 桌面播放器专有：编辑模式 + 3D 效果 ──
    const isLyricEditorMode = useDesktopPlayerStore(s => s.isLyricEditorMode)
    const setIsLyricEditorMode = useDesktopPlayerStore(s => s.setIsLyricEditorMode)

    const [bgDialogOpen, setBgDialogOpen] = useState(false)
    const [effectDialogOpen, setEffectDialogOpen] = useState(false)

    const isDesktop = scope === "desktop"

    const handleToggleHeartMode = async () => {
        if (!currentTrack || currentTrack.source !== 'netease') return

        if (heartMode) {
            setHeartMode(false)
            heartModeService.stop()
            toast.success("已关闭心动模式")
            return
        }

        try {
            toast.loading("正在开启心动模式…", { id: "heart-mode-loading" })
            await heartModeService.start(currentTrack.id, sourcePlaylistId)
            setHeartMode(true)
            toast.success("心动模式已开启", { id: "heart-mode-loading" })
        } catch (e: any) {
            toast.error(`开启心动模式失败: ${e.message}`, { id: "heart-mode-loading" })
        }
    }

    const openDesktopLyric = async () => {
        try {
            await invoke('open_desktop_lyric')
        } catch (error) {
            console.error('Failed to open desktop lyric:', error)
        }
    }

    const syncDesktopSettings = (overrides: Partial<any> = {}) => {
        emit('player:settings-sync', {
            desktopLyricFontSize: overrides.desktopLyricFontSize || desktopLyricFontSize,
            desktopLyricColor: overrides.desktopLyricColor || desktopLyricColor,
            desktopLyricStrokeColor: overrides.desktopLyricStrokeColor || desktopLyricStrokeColor,
            ...overrides
        })
    }

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <button className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10 ml-1">
                        {triggerIcon || <MoreHorizontal size={22} />}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                    align={align} 
                    className="w-48 bg-black/80 backdrop-blur-xl border-white/10 text-white"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <DropdownMenuLabel>
                        {isDesktop ? "桌面播放器设置" : "播放器设置"}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuCheckboxItem
                        checked={audioVisualization}
                        onCheckedChange={toggleAudioVisualization}
                        className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                    >
                        <Activity className="mr-2 h-4 w-4" />
                        音频律动
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={isImmersiveMode}
                        onCheckedChange={setIsImmersiveMode}
                        className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                    >
                        <Monitor className="mr-2 h-4 w-4" />
                        沉浸模式
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={hideAlbumCover}
                        onCheckedChange={setHideAlbumCover}
                        className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                    >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        隐藏封面
                    </DropdownMenuCheckboxItem>
                    {/* 编辑模式：仅桌面播放器 */}
                    {isDesktop && (
                        <DropdownMenuCheckboxItem
                            checked={isLyricEditorMode}
                            onCheckedChange={setIsLyricEditorMode}
                            className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                        >
                            <Move className="mr-2 h-4 w-4" />
                            编辑模式 (拖拽歌词)
                        </DropdownMenuCheckboxItem>
                    )}
                    {/* 浮动桌面歌词窗口：两个作用域都可打开 */}
                    <DropdownMenuItem
                        onClick={openDesktopLyric}
                        className="focus:bg-white/10 focus:text-white"
                    >
                        <Monitor className="mr-2 h-4 w-4" />
                        桌面歌词
                    </DropdownMenuItem>
                    {/* 播放器背景：仅全屏播放器 */}
                    {!isDesktop && (
                        <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); setBgDialogOpen(true) }}
                            className="focus:bg-white/10 focus:text-white"
                        >
                            <ImageIcon className="mr-2 h-4 w-4" />
                            播放器背景…
                        </DropdownMenuItem>
                    )}
                    {/* 3D 效果：仅桌面播放器 */}
                    {isDesktop && (
                        <DropdownMenuItem
                            onSelect={(e) => { e.preventDefault(); setEffectDialogOpen(true) }}
                            className="focus:bg-white/10 focus:text-white"
                        >
                            <Box className="mr-2 h-4 w-4" />
                            桌面歌词 3D 效果…
                        </DropdownMenuItem>
                    )}
                    {/* 心动模式：仅全屏播放器（依赖全局播放状态） */}
                    {!isDesktop && currentTrack?.source === 'netease' && (
                        <DropdownMenuCheckboxItem
                            checked={heartMode}
                            onCheckedChange={() => handleToggleHeartMode()}
                            className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            心动模式
                        </DropdownMenuCheckboxItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <div className="px-2 py-1.5">
                        <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                            <Disc className="mr-2 h-4 w-4" /> 歌词样式
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setLyricDisplayStyle(LyricDisplayStyle.Scroll)}
                                className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${lyricDisplayStyle === LyricDisplayStyle.Scroll ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                滚动
                            </button>
                            <button
                                onClick={() => setLyricDisplayStyle(LyricDisplayStyle.Roulette)}
                                className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${lyricDisplayStyle === LyricDisplayStyle.Roulette ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                轮盘
                            </button>
                            <button
                                onClick={() => setLyricDisplayStyle(LyricDisplayStyle.SingleLine)}
                                className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${lyricDisplayStyle === LyricDisplayStyle.SingleLine ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                单行
                            </button>
                        </div>
                        {lyricDisplayStyle === LyricDisplayStyle.SingleLine && (
                            <div className="flex gap-1 mt-2">
                                <button
                                    onClick={() => setSingleLineAnimation(SingleLineAnimation.SlideUp)}
                                    className={`flex-1 text-xs py-1 px-1 rounded transition-colors ${singleLineAnimation === SingleLineAnimation.SlideUp ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                                >
                                    上推
                                </button>
                                <button
                                    onClick={() => setSingleLineAnimation(SingleLineAnimation.Fade)}
                                    className={`flex-1 text-xs py-1 px-1 rounded transition-colors ${singleLineAnimation === SingleLineAnimation.Fade ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                                >
                                    渐变
                                </button>
                                <button
                                    onClick={() => setSingleLineAnimation(SingleLineAnimation.Zoom)}
                                    className={`flex-1 text-xs py-1 px-1 rounded transition-colors ${singleLineAnimation === SingleLineAnimation.Zoom ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                                >
                                    缩放
                                </button>
                                <button
                                    onClick={() => setSingleLineAnimation(SingleLineAnimation.Blur)}
                                    className={`flex-1 text-xs py-1 px-1 rounded transition-colors ${singleLineAnimation === SingleLineAnimation.Blur ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                                >
                                    模糊
                                </button>
                            </div>
                        )}
                    </div>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <div className="px-2 py-1.5">
                        <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                            <Type className="mr-2 h-4 w-4" /> 歌词字体
                        </div>
                        <select
                            value={lyricFontFamily}
                            onChange={(e) => setLyricFontFamily(e.target.value)}
                            className="w-full bg-white/10 text-white text-sm rounded-md px-2 py-1.5 outline-none cursor-pointer appearance-none [&>option]:text-black"
                        >
                            {LYRIC_FONT_OPTIONS.map(f => (
                                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <div className="px-2 py-1.5">
                        <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                            <Type className="mr-2 h-4 w-4" /> 歌词字号
                        </div>
                        <Slider
                            value={[lyricFontSize]}
                            max={60}
                            min={20}
                            step={1}
                            onValueChange={(v) => setLyricFontSize(v[0])}
                            className="w-full"
                        />
                    </div>
                    <div className="px-2 py-1.5 mb-1.5">
                        <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                            <Droplets className="mr-2 h-4 w-4" /> 背景模糊
                        </div>
                        <Slider
                            value={[lyricBlurStrength]}
                            max={20}
                            min={0}
                            step={1}
                            onValueChange={(v) => setLyricBlurStrength(v[0])}
                            className="w-full"
                        />
                    </div>
                    {/* 浮动桌面歌词窗口设置：两个作用域共享 */}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <div className="px-2 py-1.5">
                        <div className="flex items-center text-sm font-medium mb-2 opacity-80">
                            <Monitor className="mr-2 h-4 w-4" /> 桌面歌词字号
                        </div>
                        <Slider
                            value={[desktopLyricFontSize]}
                            max={80}
                            min={20}
                            step={1}
                            onValueChange={(v) => {
                                setDesktopLyricFontSize(v[0])
                                syncDesktopSettings({ desktopLyricFontSize: v[0] })
                            }}
                            className="w-full"
                        />
                    </div>
                    <div className="px-2 py-1.5 flex flex-col gap-2">
                        <label className="flex items-center justify-between text-sm opacity-80 cursor-pointer">
                            <div className="flex items-center"><Baseline className="mr-2 h-4 w-4" /> 桌面歌词颜色</div>
                            <input
                                type="color"
                                value={desktopLyricColor}
                                className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
                                onChange={(e) => {
                                    setDesktopLyricColor(e.target.value)
                                    syncDesktopSettings({ desktopLyricColor: e.target.value })
                                }}
                            />
                        </label>
                        <label className="flex items-center justify-between text-sm opacity-80 cursor-pointer">
                            <div className="flex items-center"><Palette className="mr-2 h-4 w-4" /> 桌面歌词描边</div>
                            <input
                                type="color"
                                value={desktopLyricStrokeColor}
                                className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
                                onChange={(e) => {
                                    setDesktopLyricStrokeColor(e.target.value)
                                    syncDesktopSettings({ desktopLyricStrokeColor: e.target.value })
                                }}
                            />
                        </label>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            {!isDesktop && (
                <BackgroundSettingsDialog
                    open={bgDialogOpen}
                    onOpenChange={setBgDialogOpen}
                />
            )}

            {isDesktop && (
                <DesktopLyricEffectDialog
                    open={effectDialogOpen}
                    onOpenChange={setEffectDialogOpen}
                />
            )}
        </>
    )
}