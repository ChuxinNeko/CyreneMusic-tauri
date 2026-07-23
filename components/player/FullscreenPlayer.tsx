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
    Sparkles,
    Repeat,
    Repeat1,
    Shuffle,
    Disc,
    AppWindow,
    ListMusic,
    Image as ImageIcon
} from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { emit } from "@tauri-apps/api/event"
import { convertFileSrc } from "@tauri-apps/api/core"
import { usePlayerStore, RepeatMode, LyricDisplayStyle } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { playerService } from "@/lib/services/playerService"
import { audioAnalyser } from "@/lib/services/audioAnalyser"
import { urlService } from "@/lib/services/urlService"
import { LyricPlayerRoulette } from "./LyricPlayerRoulette"
import dynamic from "next/dynamic"
const AMLLLyricPlayer = dynamic(() => import("./AMLLLyricPlayer").then(m => m.AMLLLyricPlayer), { ssr: false })
import { LyricPlayerSingleLine } from "./LyricPlayerSingleLine"
import { SongInfoPanel } from "./song-info/SongInfoPanel"
const AMLLBackground = dynamic(() => import("./AMLLBackground").then(m => m.AMLLBackground), { ssr: false })
const WallpaperBackground = dynamic(() => import("./WallpaperBackground").then(m => m.WallpaperBackground), { ssr: false })
import { EqualizerPanel } from "./EqualizerPanel"
import { AudioVisualizer } from "./AudioVisualizer"
import { AddToPlaylistDialog } from "./AddToPlaylistDialog"
import { playlistService } from "@/lib/services/playlistService"
import { heartModeService } from "@/lib/services/heartModeService"
import { LYRIC_FONT_OPTIONS } from "@/lib/constants/fonts"
import { BackgroundSettingsDialog } from "./BackgroundSettingsDialog"
import { Slider } from "@/components/ui/slider"
import { useAudioSourceStore, useActiveSource } from "@/lib/store/useAudioSourceStore"
import { AudioQuality } from "@/lib/services/audioSourceService"
import { lxMusicRuntimeService } from "@/lib/services/lxMusicRuntimeService"
import { AudioSourceType } from "@/lib/models/audioSourceConfig"
import { CapsulePlayerBar } from "./CapsulePlayerBar"
import { FullscreenPlaylistView } from "./FullscreenPlaylistView"
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
import { PlayerSettingsMenu } from "./PlayerSettingsMenu"
import { LyricSettingsProvider } from "./LyricSettingsContext"
import { useTheme } from "next-themes"
import { LiquidGlass } from "@/components/ui/LiquidGlass"
import { useRouter } from "next/navigation"
import { artistService } from "@/lib/services/artistService"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function FullscreenPlayer() {
    const isMobile = useIsMobile()
    const { resolvedTheme } = useTheme()

    // 移动端竖屏检测：竖屏下动态背景使用静态模式以降低 GPU 占用、缓解卡顿
    const [isPortrait, setIsPortrait] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return
        const mql = window.matchMedia('(orientation: portrait)')
        const onChange = () => setIsPortrait(mql.matches)
        mql.addEventListener('change', onChange)
        setIsPortrait(mql.matches)
        return () => mql.removeEventListener('change', onChange)
    }, [])
    const isStaticBg = isMobile && isPortrait

    // 细粒度 store 订阅：高频变化字段独立订阅，避免整组件重渲染
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const progress = usePlayerStore(s => s.progress)
    const currentTime = usePlayerStore(s => s.currentTime)
    const duration = usePlayerStore(s => s.duration)
    const volume = usePlayerStore(s => s.volume)
    const isFullscreen = usePlayerStore(s => s.isFullscreen)
    const setIsFullscreen = usePlayerStore(s => s.setIsFullscreen)
    const showTranslation = useFullscreenSettingsStore(s => s.showTranslation)
    const toggleTranslation = useFullscreenSettingsStore(s => s.toggleTranslation)
    const desktopLyricFontSize = useFullscreenSettingsStore(s => s.desktopLyricFontSize)
    const desktopLyricColor = useFullscreenSettingsStore(s => s.desktopLyricColor)
    const desktopLyricStrokeColor = useFullscreenSettingsStore(s => s.desktopLyricStrokeColor)
    const setDesktopLyricFontSize = useFullscreenSettingsStore(s => s.setDesktopLyricFontSize)
    const setDesktopLyricColor = useFullscreenSettingsStore(s => s.setDesktopLyricColor)
    const setDesktopLyricStrokeColor = useFullscreenSettingsStore(s => s.setDesktopLyricStrokeColor)
    const isLyricsFolded = useFullscreenSettingsStore(s => s.isLyricsFolded)
    const setIsLyricsFolded = useFullscreenSettingsStore(s => s.setIsLyricsFolded)
    const isImmersiveMode = useFullscreenSettingsStore(s => s.isImmersiveMode)
    const hideAlbumCover = useFullscreenSettingsStore(s => s.hideAlbumCover)
    const lyricDisplayStyle = useFullscreenSettingsStore(s => s.lyricDisplayStyle)
    const setLyricDisplayStyle = useFullscreenSettingsStore(s => s.setLyricDisplayStyle)
    const repeatMode = usePlayerStore(s => s.repeatMode)
    const setRepeatMode = usePlayerStore(s => s.setRepeatMode)
    const isTaskbarPlayerOpen = usePlayerStore(s => s.isTaskbarPlayerOpen)
    const setIsTaskbarPlayerOpen = usePlayerStore(s => s.setIsTaskbarPlayerOpen)
    const heartMode = usePlayerStore(s => s.heartMode)
    const setHeartMode = usePlayerStore(s => s.setHeartMode)
    const sourcePlaylistId = usePlayerStore(s => s.sourcePlaylistId)

    // 自定义播放器背景
    const playerBgType = useFullscreenSettingsStore(s => s.playerBgType)
    const customBgPath = useFullscreenSettingsStore(s => s.customBgPath)
    const customBgBlur = useFullscreenSettingsStore(s => s.customBgBlur)
    const customBgBrightness = useFullscreenSettingsStore(s => s.customBgBrightness)
    const customBgScale = useFullscreenSettingsStore(s => s.customBgScale)
    const customBgOverlay = useFullscreenSettingsStore(s => s.customBgOverlay)

    const [localProgress, setLocalProgress] = React.useState(0)
    const [localVolume, setLocalVolume] = React.useState(0)
    const isDraggingProgress = React.useRef(false)
    const isDraggingVolume = React.useRef(false)
    const isFullscreenRef = React.useRef(isFullscreen)
    const [isVisible, setIsVisible] = React.useState(isFullscreen)
    const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)
    const [isMaximized, setIsMaximized] = React.useState(false)
    const [rightPanelMode, setRightPanelMode] = React.useState<'lyrics' | 'info' | 'eq'>('lyrics')
    const [fullscreenView, setFullscreenView] = React.useState<'player' | 'playlist'>('player')
    React.useEffect(() => {
        if (!isFullscreen) setFullscreenView('player')
    }, [isFullscreen])
    const [dynamicCoverUrl, setDynamicCoverUrl] = React.useState<string | null>(null)
    const [isVideoLoaded, setIsVideoLoaded] = React.useState(false)
    const [isInPlaylist, setIsInPlaylist] = React.useState(false)
    const [inPlaylistIds, setInPlaylistIds] = React.useState<number[]>([])
    const [showAddToPlaylist, setShowAddToPlaylist] = React.useState(false)
    const [showAddToPlaylistMode, setShowAddToPlaylistMode] = React.useState<'add' | 'remove'>('add')
    const [qualityMenuOpen, setQualityMenuOpen] = React.useState(false)
    const [showMobileLyrics, setShowMobileLyrics] = React.useState(false)
    const [isMobileLyricsControlsHidden, setIsMobileLyricsControlsHidden] = React.useState(false)
    const autoHideControlsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const [showVolumePopover, setShowVolumePopover] = React.useState(false)
    const [coverColors, setCoverColors] = React.useState<string[]>([])
    const [isLightCover, setIsLightCover] = React.useState(false)
    const { quality, setQuality } = useAudioSourceStore()
    const activeSource = useActiveSource()
    const router = useRouter()

    // 切换到 SuperCyrene 播放器（仅桌面端生效；移动端始终使用经典播放器）。
    // 切换后保持 isFullscreen，MainLayout 会无缝换挂 SuperCyreneFullscreen。
    const setSuperCyrenePlayerEnabled = useLayoutStore(s => s.setSuperCyrenePlayerEnabled)
    const switchToSuperCyrene = React.useCallback(() => {
        setSuperCyrenePlayerEnabled(true)
    }, [setSuperCyrenePlayerEnabled])

    // 关闭全屏播放器：overlay 模式下直接隐藏
    const handleClose = React.useCallback(() => {
        setFullscreenView('player')
        setIsFullscreen(false)
    }, [setIsFullscreen])
    const [showArtistPicker, setShowArtistPicker] = React.useState(false)
    const [artistList, setArtistList] = React.useState<string[]>([])
    const [bgDialogOpen, setBgDialogOpen] = React.useState(false)

    // 双视频无缝循环淡入淡出
    const video0Ref = React.useRef<HTMLVideoElement>(null)
    const video1Ref = React.useRef<HTMLVideoElement>(null)
    const [activeVideo, setActiveVideo] = React.useState<0 | 1>(0)
    const activeVideoRef = React.useRef<0 | 1>(0)
    const crossfadeDuration = 1.5; // 1.5 seconds crossfade

    // 专辑封面 3D 倾斜：ref 直接操作 DOM，避免高频 mousemove 触发 React 重渲染
    const coverTiltRef = React.useRef<HTMLDivElement>(null)
    const tiltRAFRef = React.useRef<number>(0)
    const tiltTargetRef = React.useRef({ rx: 0, ry: 0 })
    const TILT_MAX = 8            // 最大倾斜角度（度）—— 温和
    const TILT_PERSPECTIVE = 1000

    const applyCoverTilt = () => {
        tiltRAFRef.current = 0
        const el = coverTiltRef.current
        if (!el) return
        const { rx, ry } = tiltTargetRef.current
        el.style.transform = `perspective(${TILT_PERSPECTIVE}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
    }

    const handleCoverMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const el = coverTiltRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        // 鼠标相对中心的归一化坐标 (-0.5 ~ 0.5)
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5
        tiltTargetRef.current = {
            rx: -py * 2 * TILT_MAX,   // 上下 → 绕 X 轴（取负让顶部向远离方向倾）
            ry: px * 2 * TILT_MAX,    // 左右 → 绕 Y 轴
        }
        if (!tiltRAFRef.current) {
            tiltRAFRef.current = requestAnimationFrame(applyCoverTilt)
        }
    }, [])

    const handleCoverMouseEnter = React.useCallback(() => {
        const el = coverTiltRef.current
        if (el) el.style.transition = 'transform 80ms ease-out'
    }, [])

    const handleCoverMouseLeave = React.useCallback(() => {
        if (tiltRAFRef.current) {
            cancelAnimationFrame(tiltRAFRef.current)
            tiltRAFRef.current = 0
        }
        tiltTargetRef.current = { rx: 0, ry: 0 }
        const el = coverTiltRef.current
        if (el) {
            el.style.transition = 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)'
            el.style.transform = `perspective(${TILT_PERSPECTIVE}px) rotateX(0deg) rotateY(0deg) scale(1)`
        }
    }, [])

    // 封面倾斜 rAF 清理
    React.useEffect(() => () => {
        if (tiltRAFRef.current) cancelAnimationFrame(tiltRAFRef.current)
    }, [])

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
                extractColorsFromImage(picUrl)
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
        if (!currentTrack) {
            setLocalProgress(0)
            return
        }
        if (!isDraggingProgress.current) {
            setLocalProgress(progress || 0)
        }
    }, [progress, currentTrack])

    React.useEffect(() => {
        if (!isDraggingVolume.current) {
            setLocalVolume(volume || 0)
        }
    }, [volume])

    // 全屏 overlay 入场/退场动画
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

    // 移动端 overlay 返回键处理：pushState 虚拟历史条目 + popstate 监听
    // 不依赖 evaluateJavascript 的异步回调，时序可靠
    React.useEffect(() => {
        isFullscreenRef.current = isFullscreen
    }, [isFullscreen])

    React.useEffect(() => {
        if (!isFullscreen) return
        // 向 WebView 历史栈推入虚拟条目，使返回键只 pop 此条目（URL 不变）
        window.history.pushState({ __cyreneFullscreen: true }, "")
        const onPopState = () => {
            // 返回键已 pop 虚拟条目，关闭 overlay 即可（无需再 history.back）
            if (isFullscreenRef.current) handleClose()
        }
        window.addEventListener("popstate", onPopState)
        return () => window.removeEventListener("popstate", onPopState)
    }, [isFullscreen, handleClose])

    // 非返回键关闭（如点击关闭按钮）：清理虚拟历史条目
    React.useEffect(() => {
        if (!isFullscreen && window.history.state?.__cyreneFullscreen) {
            window.history.back()
        }
    }, [isFullscreen])

    // 移动端歌词面板：进入后延迟自动折叠底部控制栏，点击歌词区域可重新唤出
    React.useEffect(() => {
        if (!isMobile || !showMobileLyrics) {
            setIsMobileLyricsControlsHidden(false)
            if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current)
            return
        }
        setIsMobileLyricsControlsHidden(false)
        if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current)
        autoHideControlsTimerRef.current = setTimeout(() => {
            setIsMobileLyricsControlsHidden(true)
        }, 4000)
        return () => {
            if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current)
        }
    }, [isMobile, showMobileLyrics])

    const handleMobileLyricsPanelTap = () => {
        if (isMobileLyricsControlsHidden) {
            setIsMobileLyricsControlsHidden(false)
            if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current)
            autoHideControlsTimerRef.current = setTimeout(() => {
                setIsMobileLyricsControlsHidden(true)
            }, 4000)
        } else {
            setIsMobileLyricsControlsHidden(true)
            if (autoHideControlsTimerRef.current) clearTimeout(autoHideControlsTimerRef.current)
        }
    }

    if (!isVisible) return null

    const hasTranslation = !!(currentTrack?.tlyric || currentTrack?.ytlrc)

    const formatTime = (seconds: number) => {
        if (!seconds || !isFinite(seconds)) return "0:00"
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
      <LyricSettingsProvider scope="fullscreen">
        <div className={`fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col transition-all duration-500 ease-in-out ${isAnimatingOut ? 'opacity-0 translate-y-full' : 'opacity-100 translate-y-0'}`}>
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0 bg-black">
                {playerBgType === 'wallpaper' ? (
                    <WallpaperBackground className="absolute inset-0" />
                ) : playerBgType === 'image' && customBgPath ? (
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `url(${convertFileSrc(customBgPath)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: `blur(${customBgBlur}px) brightness(${customBgBrightness}%)`,
                            transform: `scale(${customBgScale / 100})`,
                            transition: 'filter 200ms ease, transform 200ms ease',
                        }}
                    />
                ) : (
                    <AMLLBackground
                        album={currentTrack?.picUrl}
                        playing={isPlaying}
                        fps={60}
                        renderScale={isMobile ? 0.1 : 0.25}
                        isMobile={isMobile}
                        staticMode={isStaticBg}
                        className="absolute inset-0 w-full h-full opacity-80"
                    />
                )}
                <div
                    className="absolute inset-0 bg-black"
                    style={{ opacity: playerBgType === 'image' && customBgPath ? customBgOverlay / 100 : playerBgType === 'wallpaper' ? 0.1 : 0.2 }}
                />
            </div>
            {fullscreenView === 'playlist' && (
                <div className="absolute inset-0 z-[130]">
                    <FullscreenPlaylistView onBack={() => setFullscreenView('player')} />
                </div>
            )}

            {/* Top Bar / Close Button */}
            <div data-tauri-drag-region className={`relative z-[110] flex justify-between items-center px-6 pb-4 lg:px-8 lg:pb-4 pt-14 lg:pt-4 transition-all duration-300 overflow-hidden ${isImmersiveMode ? 'bg-gradient-to-b from-black/30 to-transparent' : ''} ${isMobile ? (showMobileLyrics ? 'max-h-0 !pt-0 !pb-0 opacity-0 pointer-events-none' : 'max-h-40') : ''}`} style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 40px) + 24px)' } : {}}>
                <button
                    onClick={handleClose}
                    className="text-white/30 hover:text-white/80 transition-colors p-2 hover:bg-white/5 rounded-full z-10"
                >
                    <ChevronDown size={28} />
                </button>
                {!isMobile && (
                    <PlayerSettingsMenu />
                )}
                <div data-tauri-drag-region className="flex-1 h-full mx-4" />
                <div className="flex items-center gap-2 z-10">
                    {isMobile && (
                        <PlayerSettingsMenu align="end" isMobile={true} />
                    )}
                    {!isMobile && (
                        <>
                            <div className="flex items-center gap-2 ml-4 text-white/50">
                                <button
                                    onClick={switchToSuperCyrene}
                                    className="p-2 rounded-full transition-colors hover:text-white hover:bg-white/10"
                                    title="切换到 SuperCyrene 播放器"
                                >
                                    <Sparkles size={20} />
                                </button>
                                <button
                                    onClick={async () => {
                                        if (isTaskbarPlayerOpen) {
                                            await invoke("close_taskbar_player")
                                            setIsTaskbarPlayerOpen(false)
                                        } else {
                                            await invoke("open_taskbar_player")
                                            setIsTaskbarPlayerOpen(true)
                                        }
                                    }}
                                    className={`p-2 rounded-full transition-colors ${isTaskbarPlayerOpen ? 'bg-white/20 text-white' : 'hover:text-white hover:bg-white/10'}`}
                                    title="任务栏播放器"
                                >
                                    <AppWindow size={20} />
                                </button>
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
            <div className={`relative z-10 grid flex-1 min-h-0 w-full max-w-[1700px] mx-auto ${isMobile ? 'overflow-hidden' : 'overflow-visible'} transition-all duration-700 ease-in-out ${isLyricsFolded ? 'grid-cols-1 max-w-[800px]' : ((lyricDisplayStyle === LyricDisplayStyle.SingleLine || hideAlbumCover) && !isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[45%_55%]')}`}>

                {/* Left Column (Desktop & Mobile) */}
                <div className={`flex flex-col items-center h-full min-h-0 w-full transition-all duration-700 ease-in-out ${isMobile ? 'overflow-hidden' : 'overflow-visible'} ${isLyricsFolded ? 'px-4' : 'px-[2vw] lg:px-[4vw]'} ${!isMobile && (lyricDisplayStyle === LyricDisplayStyle.SingleLine || hideAlbumCover) ? 'hidden' : ''}`}>
                    {/* Top flexible spacer to balance vertical position */}
                    {!isMobile && <div className="flex-[0.8] min-h-[2vh] shrink-0" />}

                    {/* Content Section: Cover/Info (+ Slides into Lyrics on Mobile) */}
                    <div className={`relative w-full min-h-0 ${isMobile ? 'overflow-hidden flex-[2.5] [container-type:size]' : 'overflow-visible flex-none'}`}>
                        <div className={`relative min-h-0 ${isMobile ? 'flex h-full w-[200%] transition-transform duration-700 ease-in-out' : 'w-full'} ${isMobile && showMobileLyrics ? '-translate-x-1/2' : 'translate-x-0'}`}>
                        {/* Part 1: Album Art & Info */}
                        <div className={`flex flex-col items-center shrink-0 ${isMobile ? 'w-1/2 overflow-hidden' : 'w-full'} ${!isMobile ? 'justify-start' : (isImmersiveMode ? 'justify-end pb-4' : 'justify-center')}`}>
                            {isMobile && <div className="flex-[0.05] min-h-0" />}
                            <div className={
                                isImmersiveMode || hideAlbumCover
                                    ? 'hidden'
                                    : `relative z-[1] aspect-square w-full ${isMobile ? 'max-w-[min(88%,38vh,88cqh)]' : 'max-w-[min(100%,40vh)]'} lg:max-w-[min(100%,45vh)] 2xl:max-w-[min(100%,50vh)] shrink transition-all duration-700`
                            }
                            >
                                {isMobile ? (
                                    /* ── Mobile: Apple Music 风格大封面 ── */
                                    <div
                                        className="relative w-full h-full rounded-[14px] overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_20px_60px_rgba(0,0,0,0.6),0_8px_20px_rgba(0,0,0,0.4)]"
                                        style={{ transform: isPlaying ? 'scale(1)' : 'scale(0.92)' }}
                                    >
                                        {currentTrack?.picUrl ? (
                                            <img src={currentTrack.picUrl} alt={currentTrack.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${dynamicCoverUrl && isVideoLoaded ? 'opacity-0' : 'opacity-100'}`} />
                                        ) : (
                                            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#1a1a1a] text-white/10 text-4xl font-bold">CYRENE</div>
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
                                ) : (
                                    /* ── Desktop: 旋转黑胶唱片 ── */
                                    <div
                                        ref={coverTiltRef}
                                        onMouseMove={handleCoverMouseMove}
                                        onMouseEnter={handleCoverMouseEnter}
                                        onMouseLeave={handleCoverMouseLeave}
                                        style={{
                                            transformStyle: 'preserve-3d',
                                            transformOrigin: 'center top',
                                        }}
                                        className="relative w-full h-full rounded-full transition-transform duration-500 bg-[#101010]/95 border border-white/15 shadow-[0_24px_55px_rgba(0,0,0,0.5),inset_0_0_0_3px_rgba(255,255,255,0.04),inset_0_0_30px_rgba(0,0,0,0.8)]"
                                    >
                                        <div
                                            className="absolute inset-0 rounded-full animate-[spin_18s_linear_infinite]"
                                            style={{ animationPlayState: isPlaying ? "running" : "paused" }}
                                        >
                                        <div
                                            className="absolute inset-[3%] rounded-full opacity-75"
                                            style={{
                                                background: "repeating-radial-gradient(circle at center, transparent 0 5%, rgba(255, 255, 255, 0.08) 5.3% 5.5%, transparent 5.8% 8%)",
                                            }}
                                        />
                                        <div className="absolute inset-[7%] rounded-full border border-white/10 shadow-[inset_0_0_16px_rgba(0,0,0,0.7)]" />
                                        <div className="absolute inset-[17%] overflow-hidden rounded-full border border-white/20 bg-black shadow-[0_0_0_3px_rgba(0,0,0,0.25)]">
                                            <div className="relative h-full w-full">
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
                                        <div className="absolute left-1/2 top-1/2 z-10 h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-gradient-to-br from-white/65 via-white/20 to-black/50 shadow-[0_1px_5px_rgba(0,0,0,0.85)]" />
                                        </div>
                                        <div
                                            className={`absolute right-[-2%] top-[-3%] z-20 h-[53%] w-[25%] origin-[85%_12%] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isPlaying ? 'rotate-[24deg]' : 'rotate-[4deg]'}`}
                                            aria-hidden="true"
                                        >
                                            <div className="absolute right-[-4%] top-[3%] h-[18%] aspect-square rounded-full bg-white shadow-[0_3px_12px_rgba(0,0,0,0.35)]" />
                                            <div className="absolute right-[6.5%] top-[8%] h-[8%] aspect-square rounded-full bg-zinc-300" />
                                            <div className="absolute right-[9.5%] top-[12%] h-[72%] w-[11%] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                                                <div className="absolute bottom-[-7%] left-1/2 h-[20%] w-[260%] -translate-x-1/2 rounded-sm bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                                                    <div className="absolute bottom-[-18%] left-[18%] h-[22%] w-[64%] rounded-sm bg-zinc-900" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                <div className="absolute inset-0 w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-500" onClick={handleMobileLyricsPanelTap}>
                                    {/* 歌词面板顶部歌曲信息栏 */}
                                    {rightPanelMode === 'lyrics' && (
                                        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 40px) + 38px)' }} onClick={e => e.stopPropagation()}>
                                            <img
                                                src={currentTrack?.picUrl || ''}
                                                alt={currentTrack?.name || ''}
                                                className="w-12 h-12 rounded-lg object-cover shadow-lg"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-white truncate">
                                                    {currentTrack?.name || '未在播放'}
                                                </div>
                                                <div className="text-xs text-white/50 truncate">
                                                    {currentTrack?.artists || '未知歌手'}
                                                </div>
                                            </div>
                                            <PlayerSettingsMenu align="end" isMobile={true} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-h-0" onClick={isMobileLyricsControlsHidden ? undefined : e => e.stopPropagation()}>
                                        {rightPanelMode === 'lyrics' ? (
                                            lyricDisplayStyle === LyricDisplayStyle.Roulette ? <LyricPlayerRoulette disableSeek={isMobileLyricsControlsHidden} /> :
                                            lyricDisplayStyle === LyricDisplayStyle.SingleLine ? <LyricPlayerSingleLine disableSeek={isMobileLyricsControlsHidden} /> :
                                            <AMLLLyricPlayer disableSeek={isMobileLyricsControlsHidden} />
                                        ) : rightPanelMode === 'info' ? <SongInfoPanel /> : <EqualizerPanel />}
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Progress & Controls Section (Mobile only — Desktop uses bottom capsule bar) */}
                    {isMobile && (
                    <>
                    <div className={`h-[0.5vh] min-h-0 shrink-0 transition-all duration-500 ${showMobileLyrics ? (isMobileLyricsControlsHidden ? 'h-0' : '') : ''}`} />
                    <div className={`relative z-20 w-full max-w-[min(100%,40vh)] lg:max-w-[min(100%,45vh)] 2xl:max-w-[min(100%,50vh)] shrink-0 space-y-4 lg:space-y-6 pb-4 transition-all duration-500 overflow-hidden ${showMobileLyrics ? (isMobileLyricsControlsHidden ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[400px] opacity-100') : ''}`}>
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
                    {isMobile && <div className={`flex-[0.15] min-h-0 transition-all duration-500 ${showMobileLyrics ? (isMobileLyricsControlsHidden ? 'flex-none h-0' : '') : ''}`} />}
                    {!isMobile && <div className="flex-1 min-h-[1vh]" />}
                </div>

                {/* Right Column (Desktop only, Col 2) */}
                {!isMobile && (
                    <div className={`relative h-full overflow-hidden transition-all duration-700 ease-in-out ${isLyricsFolded ? 'opacity-0 translate-x-full pointer-events-none w-0' : 'opacity-100 translate-x-0'}`}>
                        <div className="absolute inset-0 w-full h-full animate-in fade-in zoom-in-95 duration-500">
                            {rightPanelMode === 'lyrics' ? (
                                lyricDisplayStyle === LyricDisplayStyle.Roulette ? <LyricPlayerRoulette /> :
                                lyricDisplayStyle === LyricDisplayStyle.SingleLine ? <LyricPlayerSingleLine /> :
                                <AMLLLyricPlayer />
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
                <div className="pb-5">
                    <CapsulePlayerBar 
                        isImmersiveMode={isImmersiveMode}
                        isLightCover={isLightCover}
                        coverColors={coverColors}
                        onClose={handleClose}
                        isLyricsFolded={isLyricsFolded}
                        onToggleLyrics={() => setIsLyricsFolded(!isLyricsFolded)}
                        rightPanelMode={rightPanelMode}
                        onChangeRightPanelMode={setRightPanelMode}
                        hasTranslation={hasTranslation}
                        showTranslation={showTranslation}
                        onToggleTranslation={toggleTranslation}
                        onArtistClick={handleArtistClick}
                        onOpenPlaylist={() => setFullscreenView('playlist')}
                    />
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
      </LyricSettingsProvider>
    )
}
