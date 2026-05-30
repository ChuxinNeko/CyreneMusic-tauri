"use client"

import React from "react"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume,
    Volume2,
    ChevronDown,
    Languages,
    Minus,
    Square,
    X,
    MoreHorizontal,
    Activity,
    Info,
    Type,
    Droplets,
    Monitor,
    Baseline,
    Palette,
    SlidersHorizontal,
    Heart,
    Repeat,
    Repeat1,
    Shuffle,
    Disc
} from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { emit } from "@tauri-apps/api/event"
import { usePlayerStore, RepeatMode, LyricDisplayStyle, SingleLineAnimation } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { audioAnalyser } from "@/lib/services/audioAnalyser"
import { urlService } from "@/lib/services/urlService"
import { LyricPlayer } from "./LyricPlayer"
import { LyricPlayerRoulette } from "./LyricPlayerRoulette"
import { LyricPlayerSingleLine } from "./LyricPlayerSingleLine"
import { SongInfoPanel } from "./song-info/SongInfoPanel"
import { WebGLBackground } from "./WebGLBackground"
import { EqualizerPanel } from "./EqualizerPanel"
import { AudioVisualizer } from "./AudioVisualizer"
import { AddToPlaylistDialog } from "./AddToPlaylistDialog"
import { playlistService } from "@/lib/services/playlistService"
import { Slider } from "@/components/ui/slider"
import { useAudioSourceStore, useActiveSource } from "@/lib/store/useAudioSourceStore"
import { AudioQuality } from "@/lib/services/audioSourceService"
import { lxMusicRuntimeService } from "@/lib/services/lxMusicRuntimeService"
import { AudioSourceType } from "@/lib/models/audioSourceConfig"
import { extractColorsFromImage, extractBrightnessFromImage } from "@/lib/utils/extractColors"
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
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTheme } from "next-themes"
import { LiquidGlass } from "@/components/ui/LiquidGlass"
import { useRouter } from "next/navigation"
import { artistService } from "@/lib/services/artistService"
import { pushAndroidBackHandler } from "@/lib/utils/androidBack"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function FullscreenPlayer() {
    const isMobile = useIsMobile()
    const { resolvedTheme } = useTheme()

    // 细粒度 store 订阅：高频变化字段独立订阅，避免整组件重渲染
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const progress = usePlayerStore(s => s.progress)
    const currentTime = usePlayerStore(s => s.currentTime)
    const duration = usePlayerStore(s => s.duration)
    const volume = usePlayerStore(s => s.volume)
    const isFullscreen = usePlayerStore(s => s.isFullscreen)
    const setIsFullscreen = usePlayerStore(s => s.setIsFullscreen)
    const showTranslation = usePlayerStore(s => s.showTranslation)
    const toggleTranslation = usePlayerStore(s => s.toggleTranslation)
    const audioVisualization = usePlayerStore(s => s.audioVisualization)
    const toggleAudioVisualization = usePlayerStore(s => s.toggleAudioVisualization)
    const lyricFontSize = usePlayerStore(s => s.lyricFontSize)
    const setLyricFontSize = usePlayerStore(s => s.setLyricFontSize)
    const lyricBlurStrength = usePlayerStore(s => s.lyricBlurStrength)
    const setLyricBlurStrength = usePlayerStore(s => s.setLyricBlurStrength)
    const desktopLyricFontSize = usePlayerStore(s => s.desktopLyricFontSize)
    const desktopLyricColor = usePlayerStore(s => s.desktopLyricColor)
    const desktopLyricStrokeColor = usePlayerStore(s => s.desktopLyricStrokeColor)
    const setDesktopLyricFontSize = usePlayerStore(s => s.setDesktopLyricFontSize)
    const setDesktopLyricColor = usePlayerStore(s => s.setDesktopLyricColor)
    const setDesktopLyricStrokeColor = usePlayerStore(s => s.setDesktopLyricStrokeColor)
    const isLyricsFolded = usePlayerStore(s => s.isLyricsFolded)
    const setIsLyricsFolded = usePlayerStore(s => s.setIsLyricsFolded)
    const isImmersiveMode = usePlayerStore(s => s.isImmersiveMode)
    const setIsImmersiveMode = usePlayerStore(s => s.setIsImmersiveMode)
    const lyricDisplayStyle = usePlayerStore(s => s.lyricDisplayStyle)
    const setLyricDisplayStyle = usePlayerStore(s => s.setLyricDisplayStyle)
    const singleLineAnimation = usePlayerStore(s => s.singleLineAnimation)
    const setSingleLineAnimation = usePlayerStore(s => s.setSingleLineAnimation)
    const repeatMode = usePlayerStore(s => s.repeatMode)
    const setRepeatMode = usePlayerStore(s => s.setRepeatMode)

    const [localProgress, setLocalProgress] = React.useState(0)
    const [localVolume, setLocalVolume] = React.useState(0)
    const isDraggingProgress = React.useRef(false)
    const isDraggingVolume = React.useRef(false)
    const [isVisible, setIsVisible] = React.useState(isFullscreen)
    const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)
    const [isMaximized, setIsMaximized] = React.useState(false)
    const [rightPanelMode, setRightPanelMode] = React.useState<'lyrics' | 'info' | 'eq'>('lyrics')
    const [dynamicCoverUrl, setDynamicCoverUrl] = React.useState<string | null>(null)
    const [isVideoLoaded, setIsVideoLoaded] = React.useState(false)
    const [isInPlaylist, setIsInPlaylist] = React.useState(false)
    const [inPlaylistIds, setInPlaylistIds] = React.useState<number[]>([])
    const [showAddToPlaylist, setShowAddToPlaylist] = React.useState(false)
    const [showAddToPlaylistMode, setShowAddToPlaylistMode] = React.useState<'add' | 'remove'>('add')
    const [qualityMenuOpen, setQualityMenuOpen] = React.useState(false)
    const [showMobileLyrics, setShowMobileLyrics] = React.useState(false)
    const [showVolumePopover, setShowVolumePopover] = React.useState(false)
    const [coverColors, setCoverColors] = React.useState<string[]>([])
    const [isLightCover, setIsLightCover] = React.useState(false)
    const { quality, setQuality } = useAudioSourceStore()
    const activeSource = useActiveSource()
    const router = useRouter()
    const [showArtistPicker, setShowArtistPicker] = React.useState(false)
    const [artistList, setArtistList] = React.useState<string[]>([])

    // 双视频无缝循环淡入淡出
    const video0Ref = React.useRef<HTMLVideoElement>(null)
    const video1Ref = React.useRef<HTMLVideoElement>(null)
    const [activeVideo, setActiveVideo] = React.useState<0 | 1>(0)
    const activeVideoRef = React.useRef<0 | 1>(0)
    const crossfadeDuration = 1.5; // 1.5 seconds crossfade

    // 音频频率数据通过 ref 直接注入 WebGL，避免触发 React 重绘
    const bgRef = React.useRef<any>(null)

    // 频率数据采集循环（使用 rAF 与 WebGL 渲染器的 tick 自然同步，避免 setInterval 抖动）
    React.useEffect(() => {
        if (!isVisible || !isPlaying || !audioVisualization) {
            bgRef.current?.bgRender?.setFrequencyData(0, 0, 0)
            return
        }

        let handle = 0
        const tick = () => {
            const data = audioAnalyser.getFrequencyData()
            bgRef.current?.bgRender?.setFrequencyData(data.bass, data.mid, data.treble)
            handle = requestAnimationFrame(tick)
        }
        handle = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(handle)
        }
    }, [isVisible, isPlaying, audioVisualization])

    React.useEffect(() => {
        const updateMaximizedState = async () => {
            const appWindow = getCurrentWindow()
            setIsMaximized(await appWindow.isMaximized())
        }
        updateMaximizedState()
    }, [])

    const minimize = async () => {
        const appWindow = getCurrentWindow()
        await appWindow.minimize()
    }

    const toggleMaximize = async () => {
        const appWindow = getCurrentWindow()
        await appWindow.toggleMaximize()
        setIsMaximized(!isMaximized)
    }

    const closeWindow = async () => {
        const appWindow = getCurrentWindow()
        await appWindow.close()
    }

    const syncDesktopSettings = (overrides: Partial<any> = {}) => {
        emit('player:settings-sync', {
            desktopLyricFontSize: overrides.desktopLyricFontSize || desktopLyricFontSize,
            desktopLyricColor: overrides.desktopLyricColor || desktopLyricColor,
            desktopLyricStrokeColor: overrides.desktopLyricStrokeColor || desktopLyricStrokeColor,
            ...overrides
        })
    }

    const openDesktopLyric = async () => {
        try {
            await invoke('open_desktop_lyric')
        } catch (error) {
            console.error('Failed to open desktop lyric:', error)
        }
    }

    React.useEffect(() => {
        setDynamicCoverUrl(null)
        setIsVideoLoaded(false)
        setActiveVideo(0)
        activeVideoRef.current = 0
        if (currentTrack?.source === 'netease' && currentTrack.id) {
            fetch(`${urlService.baseUrl}/song/dynamic/cover?id=${currentTrack.id}`)
                .then(res => res.json())
                .then(result => {
                    const data = result.data || result
                    if (data?.videoPlayUrl) {
                        setDynamicCoverUrl(data.videoPlayUrl)
                    } else if (data?.dynamicCover?.coverUrl) {
                        setDynamicCoverUrl(data.dynamicCover.coverUrl)
                    }
                })
                .catch(err => console.error("Failed to fetch Netease dynamic cover:", err))
        }
        // 提取封面主题色（延迟到空闲时执行，避免阻塞主线程）
        if (currentTrack?.picUrl) {
            const picUrl = currentTrack.picUrl
            const scheduleExtract = () => {
                extractColorsFromImage(picUrl, 6)
                    .then(setCoverColors)
                    .catch(() => setCoverColors([]))
                extractBrightnessFromImage(picUrl)
                    .then(b => setIsLightCover(b > 0.6))
                    .catch(() => setIsLightCover(false))
            }
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(scheduleExtract, { timeout: 2000 })
            } else {
                setTimeout(scheduleExtract, 200)
            }
        } else {
            setCoverColors([])
            setIsLightCover(false)
        }
    }, [currentTrack])

    const checkPlaylistStatus = React.useCallback(async () => {
        if (currentTrack?.id && currentTrack?.source) {
            try {
                const status = await playlistService.checkTrackInPlaylists(currentTrack.id, currentTrack.source)
                setIsInPlaylist(status.inPlaylist)
                setInPlaylistIds(status.playlistIds || [])
            } catch (error) {
                console.error("Failed to check playlist status:", error)
            }
        } else {
            setIsInPlaylist(false)
            setInPlaylistIds([])
        }
    }, [currentTrack])

    React.useEffect(() => {
        checkPlaylistStatus()
    }, [checkPlaylistStatus])

    React.useEffect(() => {
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress])

    React.useEffect(() => {
        if (!isDraggingVolume.current) {
            setLocalVolume(volume || 0)
        }
    }, [volume])

    React.useEffect(() => {
        if (isFullscreen) {
            setIsVisible(true)
            setIsAnimatingOut(false)
        } else if (isVisible) {
            setIsAnimatingOut(true)
            const timer = setTimeout(() => {
                setIsVisible(false)
                setIsAnimatingOut(false)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [isFullscreen, isVisible])

    React.useEffect(() => {
        if (!isMobile) return
        if (isVisible) {
            invoke("set_status_bar_style", { isDarkText: false })
                .catch(e => console.error("Failed to set status bar text color:", e))
            
            // Apply landscape orientation if SingleLine is selected and it's visible
            if (lyricDisplayStyle === LyricDisplayStyle.SingleLine) {
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(e => console.error('Failed to lock orientation:', e))
                }
            } else {
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock()
                }
            }
        } else {
            if (resolvedTheme) {
                invoke("set_status_bar_style", { isDarkText: resolvedTheme === "light" })
                    .catch(e => console.error("Failed to set status bar text color:", e))
            }
            // Unlock orientation when exiting fullscreen
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock()
            }
        }
    }, [isVisible, resolvedTheme, isMobile, lyricDisplayStyle])

    React.useEffect(() => {
        if (!isMobile || !isVisible) return
        return pushAndroidBackHandler(() => {
            setIsFullscreen(false)
            return true
        })
    }, [isMobile, isVisible, setIsFullscreen])

    if (!isVisible) return null

    const hasTranslation = !!(currentTrack?.tlyric || currentTrack?.ytlrc)

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00"
        const mins = Math.floor(Math.abs(seconds) / 60)
        const secs = Math.floor(Math.abs(seconds) % 60)
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const handleTogglePlay = () => playerService.togglePlay()
    const handleSkipNext = () => playerService.playNext()
    const handleSkipPrevious = () => playerService.playPrevious()
    const handleSeekChange = (value: number[]) => {
        isDraggingProgress.current = true
        setLocalProgress(value[0])
    }

    const handleSeekCommit = (value: number[]) => {
        playerService.seek(value[0] * duration)
        setTimeout(() => {
            isDraggingProgress.current = false
        }, 200)
    }

    const handleVolumeChange = (value: number[]) => {
        isDraggingVolume.current = true
        setLocalVolume(value[0])
        playerService.setVolume(value[0])
    }

    const handleVolumeCommit = (value: number[]) => {
        playerService.setVolume(value[0])
        setTimeout(() => {
            isDraggingVolume.current = false
        }, 200)
    }

    const handleHeartClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentTrack) return

        // 如果存在于多个歌单，或者未收藏，则打开对话框
        if (inPlaylistIds.length === 0 || inPlaylistIds.length > 1) {
            setShowAddToPlaylistMode(inPlaylistIds.length === 0 ? 'add' : 'remove')
            setShowAddToPlaylist(true)
            return
        }

        // 仅存在于一个歌单，直接执行移除操作
        try {
            const playlistId = inPlaylistIds[0]
            const success = await playlistService.removeTrackFromPlaylist(playlistId, currentTrack.id, currentTrack.source)
            if (success) {
                toast.success("已从歌单中移除")
                checkPlaylistStatus()
            } else {
                toast.error("从歌单移除失败")
            }
        } catch (error) {
            console.error("Failed to remove track from playlist:", error)
            toast.error("操作失败")
        }
    }

    const parseArtists = (artistsStr: string): string[] => {
        return artistsStr
            .split(/[,\/&、，]/)
            .map(a => a.trim())
            .filter(Boolean)
    }

    const handleArtistClick = async (artistName?: string) => {
        if (!currentTrack || currentTrack.source !== 'netease') return

        const artists = parseArtists(currentTrack.artists)
        if (artists.length === 0) return

        if (artists.length === 1 || artistName) {
            const name = artistName || artists[0]
            try {
                const id = await artistService.resolveArtistIdByName(name)
                if (id) {
                    setIsFullscreen(false)
                    router.push(`/artist?id=${id}`)
                } else {
                    toast.error("未找到该歌手")
                }
            } catch {
                toast.error("跳转失败")
            }
        } else {
            setArtistList(artists)
            setShowArtistPicker(true)
        }
    }

    const getQualityLabel = (q: string) => {
        const labels: Record<string, string> = {
            [AudioQuality.Standard]: 'STANDARD',
            [AudioQuality.ExHigh]: 'EXHIGH',
            [AudioQuality.Lossless]: 'LOSSLESS',
            [AudioQuality.HiRes]: 'HIRES',
            '128k': '128K',
            '320k': '320K',
            'flac': 'FLAC',
            'flac24bit': 'FLAC24BIT',
        }
        return labels[q] || q.toUpperCase()
    }

    const getQualityOptions = () => {
        const qualityLabels: Record<string, { label: string, desc: string }> = {
            [AudioQuality.Standard]: { label: "标准音质", desc: "128kbps，节省流量" },
            [AudioQuality.ExHigh]: { label: "极高音质", desc: "320kbps，音质细腻" },
            [AudioQuality.Lossless]: { label: "无损音质", desc: "FLAC，CD 级音质" },
            [AudioQuality.HiRes]: { label: "Hi-Res 音质", desc: "24bit/96kHz 及以上" },
            '128k': { label: "标准音质", desc: "128kbps，有效节省流量" },
            '320k': { label: "极高音质", desc: "320kbps，音质更加细腻" },
            'flac': { label: "无损音质", desc: "FLAC，无损 CD 级音质" },
            'flac24bit': { label: "Hi-Res 音质", desc: "24bit/96kHz 及以上极致体验" },
        }

        let qualities: { value: string; label: string; desc: string }[] = [
            {
                value: AudioQuality.Standard,
                ...qualityLabels[AudioQuality.Standard]
            },
            {
                value: AudioQuality.ExHigh,
                ...qualityLabels[AudioQuality.ExHigh]
            },
            {
                value: AudioQuality.Lossless,
                ...qualityLabels[AudioQuality.Lossless]
            },
            {
                value: AudioQuality.HiRes,
                ...qualityLabels[AudioQuality.HiRes]
            },
        ]

        // 如果当前是洛雪音源，则动态获取支持的音质
        const isLxMusic = activeSource?.type === AudioSourceType.LxMusic
        if (isLxMusic) {
            const supported = lxMusicRuntimeService.currentScript?.supportedQualities
            if (supported && supported.length > 0) {
                qualities = supported.map(q => ({
                    value: q,
                    label: qualityLabels[q]?.label || q.toUpperCase(),
                    desc: qualityLabels[q]?.desc || "洛雪音源提供的音质"
                }))
            }
        }

        return qualities
    }

    const handleQualityChange = (newQuality: string) => {
        setQuality(newQuality)
        setQualityMenuOpen(false)
        toast.success("音质已切换", {
            description: "新音质将在下次切换歌曲时生效",
            duration: 3000,
        })
    }

    return (
        <div className={`fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col transition-all duration-500 ease-in-out ${isAnimatingOut ? 'opacity-0 translate-y-full' : 'opacity-100 translate-y-0'}`}>
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0 bg-black">
                <WebGLBackground
                    ref={bgRef}
                    album={currentTrack?.picUrl}
                    playing={isPlaying}
                    fps={60}
                    renderScale={isMobile ? 0.1 : 0.25}
                    isMobile={isMobile}
                    className="absolute inset-0 w-full h-full opacity-80"
                />
                <div className="absolute inset-0 bg-black/20" />
            </div>



            {/* Top Bar / Close Button */}
            <div data-tauri-drag-region className={`relative z-[110] flex justify-between items-center px-6 pb-4 lg:px-8 lg:pb-4 pt-14 lg:pt-4 ${isImmersiveMode ? 'bg-gradient-to-b from-black/30 to-transparent' : ''}`} style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 40px) + 24px)' } : {}}>
                <button
                    onClick={() => setIsFullscreen(false)}
                    className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10"
                >
                    <ChevronDown size={28} />
                </button>
                {!isMobile && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10 ml-1">
                            <MoreHorizontal size={22} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-black/80 backdrop-blur-xl border-white/10 text-white">
                        <DropdownMenuLabel>播放器设置</DropdownMenuLabel>
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
                        <DropdownMenuItem
                            onClick={openDesktopLyric}
                            className="focus:bg-white/10 focus:text-white"
                        >
                            <Monitor className="mr-2 h-4 w-4" />
                            桌面歌词
                        </DropdownMenuItem>
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
                )}
                <div data-tauri-drag-region className="flex-1 h-full mx-4" />
                <div className="flex items-center gap-2 z-10">
                    {isMobile && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10">
                                    <MoreHorizontal size={22} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-black/80 backdrop-blur-xl border-white/10 text-white">
                                <DropdownMenuLabel>播放器设置</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />

                                <DropdownMenuCheckboxItem
                                    checked={isImmersiveMode}
                                    onCheckedChange={setIsImmersiveMode}
                                    className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5"
                                >
                                    <Monitor className="mr-2 h-4 w-4" />
                                    沉浸模式
                                </DropdownMenuCheckboxItem>
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {!isMobile && (
                        <>
                            <div className="flex items-center gap-2 ml-4 text-white/50">
                                <button
                                    onClick={minimize}
                                    className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <Minus size={20} />
                                </button>
                                <button
                                    onClick={toggleMaximize}
                                    className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <Square size={20} />
                                </button>
                                <button
                                    onClick={closeWindow}
                                    className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors hover:bg-destructive hover:text-destructive-foreground"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Layout (45/55 Grid for Desktop, Single Col for Mobile) */}
            <div className={`relative z-10 grid flex-1 min-h-0 w-full max-w-[1700px] mx-auto overflow-hidden transition-all duration-700 ease-in-out ${isLyricsFolded ? 'grid-cols-1 max-w-[800px]' : (lyricDisplayStyle === LyricDisplayStyle.SingleLine && !isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[45%_55%]')}`}>

                {/* Left Column (Desktop & Mobile) */}
                <div className={`flex flex-col items-center h-full min-h-0 overflow-hidden w-full transition-all duration-700 ease-in-out ${isLyricsFolded ? 'px-4' : 'px-[4vw] lg:px-[6vw]'} ${!isMobile && lyricDisplayStyle === LyricDisplayStyle.SingleLine ? 'hidden' : ''}`}>
                    {/* Top flexible spacer to balance vertical position */}
                    {!isMobile && <div className="flex-[0.8] min-h-[2vh] shrink-0" />}

                    {/* Content Section: Cover/Info (+ Slides into Lyrics on Mobile) */}
                    <div className={`relative w-full min-h-0 overflow-hidden ${isMobile ? 'flex-[2.5]' : 'flex-none'}`}>
                        <div className={`relative min-h-0 ${isMobile ? 'flex h-full w-[200%] transition-transform duration-700 ease-in-out' : 'w-full'} ${isMobile && showMobileLyrics ? '-translate-x-1/2' : 'translate-x-0'}`}>
                        {/* Part 1: Album Art & Info */}
                        <div className={`flex flex-col items-center shrink-0 ${isMobile ? 'w-1/2 overflow-hidden' : 'w-full'} ${!isMobile ? 'justify-start' : (isImmersiveMode ? 'justify-end pb-4' : 'justify-center')}`}>
                            {isMobile && <div className="flex-[0.05] min-h-0" />}
                            <div className={
                                isImmersiveMode
                                    ? 'hidden'
                                    : "relative aspect-square w-full max-w-[min(100%,40vh)] lg:max-w-[min(100%,45vh)] 2xl:max-w-[min(100%,50vh)] shrink transition-all duration-700"
                            }
                            >
                                <div className={isImmersiveMode ? "relative w-full h-full overflow-hidden" : "relative w-full h-full rounded-[20px] overflow-hidden transition-transform duration-500 hover:scale-[1.02] bg-white/5 border border-white/10"}
                                >
                                    {currentTrack?.picUrl ? (
                                        <img src={currentTrack.picUrl} alt={currentTrack.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${dynamicCoverUrl && isVideoLoaded ? 'opacity-0' : 'opacity-100'}`} />
                                    ) : (
                                        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">CYRENE</div>
                                    )}
                                    {dynamicCoverUrl && (
                                        <>
                                            <video
                                                ref={video0Ref}
                                                src={dynamicCoverUrl}
                                                autoPlay={activeVideo === 0}
                                                muted
                                                playsInline
                                                onLoadedData={() => { if (activeVideo === 0) setIsVideoLoaded(true); }}
                                                onTimeUpdate={() => {
                                                    if (activeVideoRef.current !== 0 || !video0Ref.current || !video1Ref.current) return;
                                                    const v0 = video0Ref.current;
                                                    if (v0.duration - v0.currentTime <= crossfadeDuration) {
                                                        activeVideoRef.current = 1;
                                                        video1Ref.current.currentTime = 0;
                                                        video1Ref.current.play();
                                                        setActiveVideo(1);
                                                    }
                                                }}
                                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded && activeVideo === 0 ? 'opacity-100' : 'opacity-0'}`}
                                            />
                                            <video
                                                ref={video1Ref}
                                                src={dynamicCoverUrl}
                                                muted
                                                playsInline
                                                onTimeUpdate={() => {
                                                    if (activeVideoRef.current !== 1 || !video1Ref.current || !video0Ref.current) return;
                                                    const v1 = video1Ref.current;
                                                    if (v1.duration - v1.currentTime <= crossfadeDuration) {
                                                        activeVideoRef.current = 0;
                                                        video0Ref.current.currentTime = 0;
                                                        video0Ref.current.play();
                                                        setActiveVideo(0);
                                                    }
                                                }}
                                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded && activeVideo === 1 ? 'opacity-100' : 'opacity-0'}`}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* Desktop Non-Immersive Audio Visualizer Capsule */}
                            {!isMobile && !isImmersiveMode && (
                                <div className="flex justify-center mt-3 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <AudioVisualizer
                                        colors={coverColors}
                                        isPlaying={isPlaying}
                                    />
                                </div>
                            )}
                            {isMobile && (
                            <>
                            <div className="h-[3vh] min-h-[16px] shrink-0" />
                            <div className="relative z-10 w-full max-w-[min(100%,40vh)] lg:max-w-[min(100%,45vh)] 2xl:max-w-[min(100%,50vh)] shrink-0 flex flex-col items-start text-left space-y-1 lg:space-y-2">
                                <div className="flex w-full justify-between items-center gap-4">
                                    <h1 className="text-[clamp(1.5rem,4vh,2.6rem)] font-bold text-white leading-tight tracking-[-0.5px] truncate flex-1">
                                        {currentTrack?.name || "未在播放"}
                                    </h1>
                                    {currentTrack && (
                                        <button onClick={handleHeartClick} className={`p-2 rounded-full transition-all duration-300 shrink-0 ${isInPlaylist ? 'text-red-500' : 'text-white/30 hover:text-white/80 hover:bg-white/10'}`}>
                                            <Heart size={24} fill={isInPlaylist ? "currentColor" : "none"} />
                                        </button>
                                    )}
                                </div>
                                <p
                                    className={`text-[clamp(1rem,2vh,1.3rem)] font-medium truncate w-full ${currentTrack?.source === 'netease' ? 'text-white/50 hover:text-white/80 cursor-pointer transition-colors' : 'text-white/50'}`}
                                    onClick={() => currentTrack?.source === 'netease' && handleArtistClick()}
                                >
                                    {currentTrack?.artists || "未知歌手"}
                                </p>
                                <div className="flex w-full justify-end">
                                    <button
                                        onClick={() => {
                                            const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
                                            const currentIndex = modes.indexOf(repeatMode)
                                            setRepeatMode(modes[(currentIndex + 1) % modes.length])
                                        }}
                                        className={`transition-colors p-1.5 ${repeatMode === RepeatMode.All ? 'text-white/30 hover:text-white/60' : 'text-white/80 hover:text-white'}`}
                                    >
                                        {repeatMode === RepeatMode.One ? <Repeat1 size={20} /> : repeatMode === RepeatMode.Shuffle ? <Shuffle size={20} /> : <Repeat size={20} />}
                                    </button>
                                </div>
                            </div>
                            </>
                            )}
                        </div>

                        {/* Part 2: Panel Section (Mobile only, slides behind Info) */}
                        {isMobile && (
                            <div className="relative h-full overflow-hidden shrink-0 w-1/2">
                                <div className="absolute inset-0 w-full h-full animate-in fade-in zoom-in-95 duration-500">
                                    {rightPanelMode === 'lyrics' ? (
                                        lyricDisplayStyle === LyricDisplayStyle.Roulette ? <LyricPlayerRoulette /> :
                                        lyricDisplayStyle === LyricDisplayStyle.SingleLine ? <LyricPlayerSingleLine /> :
                                        <LyricPlayer />
                                    ) : rightPanelMode === 'info' ? <SongInfoPanel /> : <EqualizerPanel />}
                                </div>
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Progress & Controls Section (Mobile only — Desktop uses bottom capsule bar) */}
                    {isMobile && (
                    <>
                    <div className="h-[0.5vh] min-h-0 shrink-0" />
                    <div className="relative z-20 w-full max-w-[min(100%,40vh)] lg:max-w-[min(100%,45vh)] 2xl:max-w-[min(100%,50vh)] shrink-0 space-y-4 lg:space-y-6 pb-4">
                        {/* Progress */}
                        <div className="space-y-2 lg:space-y-3 group/progress">
                            <div className="h-3 flex items-center">
                                <Slider
                                    value={[localProgress]}
                                    max={1}
                                    step={0.0001}
                                    onValueChange={handleSeekChange}
                                    onValueCommit={handleSeekCommit}
                                    className="w-full"
                                    variant="apple"
                                    highlightRanges={duration > 0 ? currentTrack?.chorus?.map(c => ({
                                        start: (c.startTime / 1000) / duration,
                                        end: (c.endTime / 1000) / duration
                                    })) : undefined}
                                />
                            </div>
                            <div className="relative flex justify-between items-center text-[0.75rem] text-white/50 font-semibold tabular-nums tracking-wider px-1">
                                <span>{formatTime(isDraggingProgress.current ? localProgress * duration : currentTime)}</span>
                                <DropdownMenu open={qualityMenuOpen} onOpenChange={setQualityMenuOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <button className="text-[0.6rem] text-white/80 bg-white/10 px-1.5 py-0.5 rounded-[4px] font-bold tracking-widest uppercase hover:bg-white/20 transition-colors">
                                            {getQualityLabel(quality)}
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="w-56 bg-black/90 backdrop-blur-xl border-white/10 text-white">
                                        <div className="px-2 py-1.5 text-xs font-medium text-white/60 border-b border-white/10 mb-1">音质选择</div>
                                        {getQualityOptions().map((q) => (
                                            <DropdownMenuCheckboxItem key={q.value} checked={quality === q.value} onCheckedChange={() => handleQualityChange(q.value)} className="focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5 py-2">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{q.label}</span>
                                                    <span className="text-xs text-white/50">{q.desc}</span>
                                                </div>
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <span>-{formatTime(Math.max(0, duration - (isDraggingProgress.current ? localProgress * duration : currentTime)))}</span>
                            </div>
                        </div>

                        {/* Playback Buttons */}
                        <div className="flex items-center justify-center gap-8 lg:gap-12 mt-2 lg:mt-4 mb-2 lg:mb-6">
                            <button onClick={handleSkipPrevious} className="text-white/90 hover:text-white transition-all active:scale-90 p-2">
                                <img src="/icon/icon_rewind.svg" alt="Previous" className="w-[60px] h-[60px] lg:w-[72px] lg:h-[72px] invert brightness-200" style={{ filter: 'invert(1) brightness(100)' }} />
                            </button>
                            <button onClick={handleTogglePlay} className="text-white hover:text-white/90 active:scale-95 transition-all p-2">
                                {isPlaying ? <img src="/icon/icon_pause.svg" alt="Pause" className="w-[72px] h-[72px] lg:w-[84px] lg:h-[84px]" style={{ filter: 'invert(1) brightness(100)' }} /> : <img src="/icon/icon_play.svg" alt="Play" className="w-[72px] h-[72px] lg:w-[84px] lg:h-[84px]" style={{ filter: 'invert(1) brightness(100)' }} />}
                            </button>
                            <button onClick={handleSkipNext} className="text-white/90 hover:text-white transition-all active:scale-90 p-2">
                                <img src="/icon/icon_forward.svg" alt="Next" className="w-[60px] h-[60px] lg:w-[72px] lg:h-[72px] invert brightness-200" style={{ filter: 'invert(1) brightness(100)' }} />
                            </button>
                        </div>

                        {/* Mobile Actions */}
                        <div className="space-y-4 lg:space-y-6 mt-4">
                            {/* Mobile Dynamic Buttons */}
                            <div className="flex items-center justify-center gap-8 py-2">
                                <button onClick={() => { if (showMobileLyrics && rightPanelMode === 'lyrics') { setShowMobileLyrics(false); } else { setRightPanelMode('lyrics'); setShowMobileLyrics(true); } }} className={`flex flex-col items-center transition-all ${showMobileLyrics && rightPanelMode === 'lyrics' ? 'text-white opacity-100' : 'text-white opacity-30'}`}>
                                    <div className={`p-2.5 rounded-full transition-colors ${showMobileLyrics && rightPanelMode === 'lyrics' ? 'bg-white/15 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-transparent'}`}>
                                        <img src="/icon/icon_lyrics.svg" alt="Lyrics" className="w-6 h-6 invert brightness-200" />
                                    </div>
                                </button>
                                <button onClick={() => { if (showMobileLyrics && rightPanelMode === 'info') { setShowMobileLyrics(false); } else { setRightPanelMode('info'); setShowMobileLyrics(true); } }} className={`flex flex-col items-center transition-all ${showMobileLyrics && rightPanelMode === 'info' ? 'text-white opacity-100' : 'text-white opacity-30'}`}>
                                    <div className={`p-2.5 rounded-full transition-colors ${showMobileLyrics && rightPanelMode === 'info' ? 'bg-white/15 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-transparent'}`}>
                                        <Info size={24} className="opacity-100" />
                                    </div>
                                </button>

                                {hasTranslation && (
                                    <button onClick={toggleTranslation} className={`flex flex-col items-center transition-all ${showTranslation ? 'text-white opacity-100' : 'text-white opacity-30'}`}>
                                        <div className={`p-2.5 rounded-full transition-colors ${showTranslation ? 'bg-white/15 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-transparent'}`}>
                                            <Languages size={24} className="opacity-100" />
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                    {isMobile && <div className="flex-[0.15] min-h-0" />}
                    {!isMobile && <div className="flex-1 min-h-[1vh]" />}
                </div>

                {/* Right Column (Desktop only, Col 2) */}
                {!isMobile && (
                    <div className={`relative h-full overflow-hidden transition-all duration-700 ease-in-out ${isLyricsFolded ? 'opacity-0 translate-x-full pointer-events-none w-0' : 'opacity-100 translate-x-0'}`}>
                        <div className="absolute inset-0 w-full h-full animate-in fade-in zoom-in-95 duration-500">
                            {rightPanelMode === 'lyrics' ? (
                                lyricDisplayStyle === LyricDisplayStyle.Roulette ? <LyricPlayerRoulette /> :
                                lyricDisplayStyle === LyricDisplayStyle.SingleLine ? <LyricPlayerSingleLine /> :
                                <LyricPlayer />
                            ) : rightPanelMode === 'info' ? (
                                <SongInfoPanel />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <EqualizerPanel />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Immersive Cover (rendered outside grid to avoid overflow clipping) */}
            {isMobile && isImmersiveMode && (
                <div
                    className="absolute inset-x-0 top-0 z-[1] pointer-events-none transition-all duration-700"
                    style={{
                        height: '55vh',
                        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 35%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 35%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
                    }}
                >
                    <div className="relative w-full h-full overflow-hidden">
                        {currentTrack?.picUrl ? (
                            <img src={currentTrack.picUrl} alt={currentTrack.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${dynamicCoverUrl && isVideoLoaded ? 'opacity-0' : 'opacity-100'}`} />
                        ) : (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">CYRENE</div>
                        )}
                        {dynamicCoverUrl && (
                            <>
                                <video
                                    src={dynamicCoverUrl}
                                    autoPlay={activeVideo === 0}
                                    muted
                                    playsInline
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded && activeVideo === 0 ? 'opacity-100' : 'opacity-0'}`}
                                />
                                <video
                                    src={dynamicCoverUrl}
                                    muted
                                    playsInline
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded && activeVideo === 1 ? 'opacity-100' : 'opacity-0'}`}
                                />
                            </>
                        )}
                        {/* Dark gradient overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/70" />
                    </div>
                </div>
            )}

            {/* Desktop Immersive Cover (rendered outside grid to avoid overflow clipping) */}
            {!isMobile && isImmersiveMode && (
                <div
                    className="absolute inset-y-0 left-0 w-[50vw] z-[1] pointer-events-none transition-all duration-700"
                    style={{
                        maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.3) 65%, rgba(0,0,0,0) 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.3) 65%, rgba(0,0,0,0) 100%)'
                    }}
                >
                    <div className="relative w-full h-full">
                        {currentTrack?.picUrl ? (
                            <img src={currentTrack.picUrl} alt={currentTrack.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${dynamicCoverUrl && isVideoLoaded ? 'opacity-0' : 'opacity-100'}`} />
                        ) : (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">CYRENE</div>
                        )}
                        {dynamicCoverUrl && (
                            <>
                                <video
                                    src={dynamicCoverUrl}
                                    autoPlay={activeVideo === 0}
                                    muted
                                    playsInline
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded && activeVideo === 0 ? 'opacity-100' : 'opacity-0'}`}
                                />
                                <video
                                    src={dynamicCoverUrl}
                                    muted
                                    playsInline
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded && activeVideo === 1 ? 'opacity-100' : 'opacity-0'}`}
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Desktop Bottom Capsule Bar */}
            {!isMobile && (
                <div className={`relative z-[120] flex justify-center items-center gap-4 pb-6 px-8 transition-[filter] duration-500 ${isImmersiveMode && isLightCover ? '[&_button]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] [&_span]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] [&_img]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''}`}>
                    {/* Left Capsule: Minimize + Toggle Lyrics */}
                    <div
                        className="relative flex items-center gap-2 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] rounded-full px-4 py-2.5 backdrop-blur-md"
                    >
                        <LiquidGlass className="bg-white/10" />
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="text-white/50 hover:text-white transition-colors p-1.5"
                            title="最小化播放器"
                        >
                            <ChevronDown size={20} />
                        </button>
                        <button
                            onClick={() => setIsLyricsFolded(!isLyricsFolded)}
                            className={`p-1.5 transition-colors ${isLyricsFolded ? 'text-white' : 'text-white/50 hover:text-white'}`}
                            title={isLyricsFolded ? '展开歌词' : '折叠歌词'}
                        >
                            <img src="/icon/icon_lyrics.svg" alt="Lyrics" className="w-5 h-5" style={{ filter: 'invert(1) brightness(100)', opacity: isLyricsFolded ? 1 : 0.6 }} />
                        </button>
                        <div className="w-[1px] h-4 bg-white/10 mx-1" />
                        <button
                            onClick={() => setRightPanelMode(rightPanelMode === 'info' ? 'lyrics' : 'info')}
                            className={`p-1.5 rounded-full transition-colors ${rightPanelMode === 'info' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                            title={rightPanelMode === 'info' ? '显示歌词' : '切换歌曲信息'}
                        >
                            <Info size={20} />
                        </button>
                        <button
                            onClick={() => setRightPanelMode(rightPanelMode === 'eq' ? 'lyrics' : 'eq')}
                            className={`p-1.5 rounded-full transition-colors ${rightPanelMode === 'eq' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                            title={rightPanelMode === 'eq' ? '关闭均衡器' : '均衡器设置'}
                        >
                            <SlidersHorizontal size={20} />
                        </button>
                        {hasTranslation && (
                            <button
                                onClick={toggleTranslation}
                                className={`p-1.5 rounded-full transition-colors ${showTranslation ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                                title={showTranslation ? '隐藏翻译' : '显示翻译'}
                            >
                                <Languages size={20} />
                            </button>
                        )}
                    </div>

                    {/* Center Capsule: Song Info + Playback + Progress */}
                    <div
                        className="relative flex items-center gap-5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] rounded-full px-5 py-2.5 flex-1 max-w-[900px] backdrop-blur-md"
                    >
                        <LiquidGlass className="bg-white/10" />
                        {/* Mini Cover + Info */}
                        <div className="flex items-center gap-2.5 min-w-[140px] shrink-0">
                            {currentTrack?.picUrl ? (
                                <img src={currentTrack.picUrl} alt={currentTrack.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white/30 text-xs">♪</div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <span className="text-[13px] font-bold text-white truncate">{currentTrack?.name || '未在播放'}</span>
                                <span
                                    className={`text-[11px] truncate ${currentTrack?.source === 'netease' ? 'text-white/50 hover:text-white/80 cursor-pointer transition-colors' : 'text-white/50'}`}
                                    onClick={() => currentTrack?.source === 'netease' && handleArtistClick()}
                                >{currentTrack?.artists || '未知歌手'}</span>
                            </div>
                        </div>

                        {/* Playback Buttons */}
                        <div className="flex items-center gap-4 shrink-0">
                            {/* Immersive Mode Audio Visualizer (compact) */}
                            {isImmersiveMode && (
                                <AudioVisualizer
                                    colors={coverColors}
                                    compact
                                    isPlaying={isPlaying}
                                    className="mr-1"
                                />
                            )}
                            <button onClick={handleSkipPrevious} className="text-white/80 hover:text-white transition-all active:scale-90">
                                <img src="/icon/icon_rewind.svg" alt="Previous" className="w-5 h-5" style={{ filter: 'invert(1) brightness(100)' }} />
                            </button>
                            <button onClick={handleTogglePlay} className="text-white hover:text-white/90 active:scale-95 transition-all">
                                {isPlaying
                                    ? <img src="/icon/icon_pause.svg" alt="Pause" className="w-7 h-7" style={{ filter: 'invert(1) brightness(100)' }} />
                                    : <img src="/icon/icon_play.svg" alt="Play" className="w-7 h-7" style={{ filter: 'invert(1) brightness(100)' }} />
                                }
                            </button>
                            <button onClick={handleSkipNext} className="text-white/80 hover:text-white transition-all active:scale-90">
                                <img src="/icon/icon_forward.svg" alt="Next" className="w-5 h-5" style={{ filter: 'invert(1) brightness(100)' }} />
                            </button>
                            {/* Heart Button */}
                            {currentTrack && (
                                <button onClick={handleHeartClick} className={`transition-all duration-300 ${isInPlaylist ? 'text-red-500' : 'text-white/50 hover:text-white/80'}`}>
                                    <Heart size={18} fill={isInPlaylist ? "currentColor" : "none"} />
                                </button>
                            )}
                            {/* Repeat Mode Button */}
                            <button
                                onClick={() => {
                                    const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
                                    const currentIndex = modes.indexOf(repeatMode)
                                    setRepeatMode(modes[(currentIndex + 1) % modes.length])
                                }}
                                className={`transition-colors ${repeatMode === RepeatMode.All ? 'text-white/50 hover:text-white/80' : 'text-white hover:text-white/90'}`}
                                title={repeatMode === RepeatMode.All ? '顺序播放' : repeatMode === RepeatMode.One ? '单曲循环' : '随机播放'}
                            >
                                {repeatMode === RepeatMode.One ? <Repeat1 size={18} /> : repeatMode === RepeatMode.Shuffle ? <Shuffle size={18} /> : <Repeat size={18} />}
                            </button>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className="text-[11px] text-white/50 font-semibold tabular-nums shrink-0">{formatTime(isDraggingProgress.current ? localProgress * duration : currentTime)}</span>
                            <div className="flex-1 h-3 flex items-center">
                                <Slider
                                    value={[localProgress]}
                                    max={1}
                                    step={0.0001}
                                    onValueChange={handleSeekChange}
                                    onValueCommit={handleSeekCommit}
                                    className="w-full"
                                    variant="apple"
                                />
                            </div>
                            <span className="text-[11px] text-white/50 font-semibold tabular-nums shrink-0">{formatTime(Math.max(0, duration - (isDraggingProgress.current ? localProgress * duration : currentTime)))}</span>
                        </div>
                    </div>

                    {/* Right Capsule: Volume (expands left on hover) */}
                    <div
                        className="relative group/volbtn flex items-center h-12 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] rounded-full overflow-hidden transition-all duration-300 ease-in-out w-12 hover:w-[200px] backdrop-blur-md"
                    >
                        <LiquidGlass className="bg-white/10 group-hover/volbtn:bg-white/15 transition-colors" />
                        {/* Slider (visible on hover) */}
                        <div className="flex items-center gap-2 pl-3.5 pr-1 opacity-0 group-hover/volbtn:opacity-100 transition-opacity duration-300 absolute left-0 top-0 bottom-0 right-12 z-10">
                            <Volume size={14} className="text-white/50 shrink-0" />
                            <div className="flex-1 h-3 flex items-center">
                                <Slider
                                    value={[localVolume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                    onValueCommit={handleVolumeCommit}
                                    className="w-full"
                                    variant="apple"
                                />
                            </div>
                        </div>
                        {/* Icon (always visible, anchored right) */}
                        <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center z-10 text-white/70 group-hover/volbtn:text-white transition-colors">
                            <Volume2 size={20} />
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={showArtistPicker} onOpenChange={setShowArtistPicker}>
                <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle>选择歌手</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 mt-2">
                        {artistList.map((name) => (
                            <button
                                key={name}
                                className="w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/15 transition-colors text-sm font-medium"
                                onClick={() => {
                                    setShowArtistPicker(false)
                                    handleArtistClick(name)
                                }}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <AddToPlaylistDialog
                open={showAddToPlaylist}
                onOpenChange={setShowAddToPlaylist}
                track={currentTrack}
                onStatusChange={checkPlaylistStatus}
                mode={showAddToPlaylistMode}
            />
        </div>
    )
}
