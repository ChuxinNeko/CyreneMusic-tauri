"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { usePlayerStore, RepeatMode } from "@/lib/store/usePlayerStore"
import { useFullscreenSettingsStore } from "@/lib/store/useFullscreenSettingsStore"
import { playerService } from "@/lib/services/playerService"
import { Minimize2, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, VolumeX, Heart, Music2, X, Minus, Square, ListMusic, Disc3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { INTRO_DELAY, parseLyrics } from "@/components/player/parser"
import { DefaultLyrics } from "./DefaultLyrics"
import { PixelLyrics } from "./PixelLyrics"
import { FlipLyrics } from "./FlipLyrics"
import { GalaxyLyrics } from "./GalaxyLyrics"
import { ChatLyrics } from "./ChatLyrics"
import { SuperCyrenePlaybackCapsule } from "./SuperCyrenePlaybackCapsule"
import { GlassProgressBar } from "./GlassProgressBar"
import { convertFileSrc } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import dynamic from "next/dynamic"

const AMLLBackground = dynamic(() => import("../AMLLBackground").then(m => m.AMLLBackground), { ssr: false })
const WallpaperBackground = dynamic(() => import("../WallpaperBackground").then(m => m.WallpaperBackground), { ssr: false })
const FullscreenPlaylistView = dynamic(() => import("../FullscreenPlaylistView").then(m => m.FullscreenPlaylistView), { ssr: false })

export function SuperCyreneFullscreen() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isFullscreen = usePlayerStore((s) => s.isFullscreen)
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const repeatMode = usePlayerStore((s) => s.repeatMode)
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode)
  const heartMode = usePlayerStore((s) => s.heartMode)
  // 切回经典播放器：仅需关闭 SuperCyrene 开关，MainLayout 会无缝换挂 FullscreenPlayer。
  const setSuperCyrenePlayerEnabled = useLayoutStore((s) => s.setSuperCyrenePlayerEnabled)
  const lyricLines = useMemo(() => parseLyrics(currentTrack), [currentTrack])
  const currentLyricTranslation = useMemo(() => {
    const lyricTime = currentTime * 1000 + INTRO_DELAY
    for (let index = lyricLines.length - 1; index >= 0; index -= 1) {
      const line = lyricLines[index]
      if (line.startTime <= lyricTime) return line.translation?.trim() || null
    }
    return null
  }, [currentTime, lyricLines])

  // 背景设置：与 FullscreenPlayer 保持一致
  const playerBgType = useFullscreenSettingsStore(s => s.playerBgType)
  const customBgPath = useFullscreenSettingsStore(s => s.customBgPath)
  const customBgBlur = useFullscreenSettingsStore(s => s.customBgBlur)
  const customBgBrightness = useFullscreenSettingsStore(s => s.customBgBrightness)
  const customBgScale = useFullscreenSettingsStore(s => s.customBgScale)
  const customBgOverlay = useFullscreenSettingsStore(s => s.customBgOverlay)

  // 歌词主题：默认 / 像素
  const lyricsTheme = useFullscreenSettingsStore(s => s.lyricsTheme)
  const setLyricsTheme = useFullscreenSettingsStore(s => s.setLyricsTheme)

  const backgroundStatic = lyricsTheme === 'pixel' || lyricsTheme === 'flip' || lyricsTheme === 'galaxy'
  const [isVisible, setIsVisible] = useState(false)
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const isFullscreenRef = useRef(isFullscreen)
  const [isTitleBarVisible, setIsTitleBarVisible] = useState(false)
  const titleBarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Window control functions
  const handleMinimize = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.minimize()
  }, [])

  const handleMaximize = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.toggleMaximize()
  }, [])

  const handleCloseWindow = useCallback(async () => {
    const appWindow = getCurrentWindow()
    await appWindow.close()
  }, [])

  // 全屏状态同步：overlay 模式入场动画
  useEffect(() => {
    if (isFullscreen) {
      // 小延迟让动画入场
      const t = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(t)
    } else {
      setIsVisible(false)
    }
  }, [isFullscreen])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => setIsFullscreen(false), 300)
  }, [setIsFullscreen])

  // ESC 退出
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
      if (e.key === " " || e.code === "Space") {
        e.preventDefault()
        playerService.togglePlay()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen, handleClose])

  // 移动端 overlay 返回键处理：pushState 虚拟历史条目 + popstate 监听
  useEffect(() => {
    isFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return
    window.history.pushState({ __cyreneFullscreen: true }, "")
    const onPopState = () => {
      if (isFullscreenRef.current) handleClose()
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [isFullscreen, handleClose])

  // 非返回键关闭（如点击关闭按钮）：清理虚拟历史条目
  useEffect(() => {
    if (!isFullscreen && window.history.state?.__cyreneFullscreen) {
      window.history.back()
    }
  }, [isFullscreen])

  const repeatIcon = useMemo(() => {
    switch (repeatMode) {
      case RepeatMode.One: return <Repeat1 className="w-5 h-5" />
      case RepeatMode.Shuffle: return <Shuffle className="w-5 h-5" />
      default: return <Repeat className="w-5 h-5" />
    }
  }, [repeatMode])

  if (!isFullscreen) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-black transition-all duration-300",
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-[1.02] pointer-events-none"
      )}
    >
      {/* 顶部悬停触发区 */}
      <div
        className="absolute top-0 left-0 right-0 h-8 z-50"
        onMouseEnter={() => {
          if (titleBarTimerRef.current) clearTimeout(titleBarTimerRef.current)
          setIsTitleBarVisible(true)
        }}
      />

      {/* 标题栏 — 融入背景的渐变式设计 */}
      <div
        data-tauri-drag-region
        className={cn(
          "absolute top-0 left-0 right-0 z-50",
          "transition-all duration-500 ease-out",
          isTitleBarVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-full pointer-events-none"
        )}
        onMouseLeave={() => {
          titleBarTimerRef.current = setTimeout(() => setIsTitleBarVisible(false), 800)
        }}
        onMouseEnter={() => {
          if (titleBarTimerRef.current) clearTimeout(titleBarTimerRef.current)
        }}
      >
        {/* 渐变背景 — 从顶部黑色渐变到透明，自然融入动态背景 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />

        {/* 内容层 */}
        <div className="relative flex items-center h-11 px-4 gap-2">
          {/* 拖拽区域 + 歌曲名 */}
          <div data-tauri-drag-region className="flex-1 h-full flex items-center">
            <span data-tauri-drag-region className="text-[11px] text-white/30 font-medium tracking-wider select-none">
              {currentTrack?.name || "Cyrene Player"}
            </span>
          </div>

          {/* 窗口控制按钮 — 幽灵风格，融入背景 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSuperCyrenePlayerEnabled(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white/80 hover:bg-white/10 transition-all duration-200"
              title="切换到经典播放器"
            >
              <Disc3 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white/80 hover:bg-white/10 transition-all duration-200"
              title="退出全屏播放器"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <button
              onClick={handleMinimize}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white/80 hover:bg-white/10 transition-all duration-200"
              title="最小化窗口"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white/80 hover:bg-white/10 transition-all duration-200"
              title="最大化"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={handleCloseWindow}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/25 hover:text-white hover:bg-white/15 transition-all duration-200"
              title="关闭"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 主体：动态背景 + 歌词层 */}
      <div className="flex-1 relative overflow-hidden">
        {/* Ambient Background — 与 FullscreenPlayer 保持一致 */}
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
              fps={30}
              renderScale={0.2}
              flowSpeed={0.15}
              staticMode={backgroundStatic}
              className="absolute inset-0 w-full h-full opacity-80"
            />
          )}
          <div
            className="absolute inset-0 bg-black"
            style={{
              opacity: playerBgType === 'image' && customBgPath
                ? customBgOverlay / 100
                : playerBgType === 'wallpaper'
                  ? 0.1
                  : 0.2,
            }}
          />
        </div>

        <div className="relative z-10 h-full w-full">
          {lyricsTheme === 'pixel' ? <PixelLyrics /> : lyricsTheme === 'flip' ? <FlipLyrics /> : lyricsTheme === 'galaxy' ? <GalaxyLyrics /> : lyricsTheme === 'chat' ? <ChatLyrics /> : <DefaultLyrics />}
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 z-20 w-[min(24rem,calc(100vw-10rem))] -translate-x-1/2">
        {currentLyricTranslation && (
          <p className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] left-1/2 w-full -translate-x-1/2 text-center text-sm font-medium tracking-wide text-white/75 [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]">
            {currentLyricTranslation}
          </p>
        )}
        <SuperCyrenePlaybackCapsule
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          title={currentTrack?.name}
          onSeek={(time) => playerService.seek(time)}
          onTogglePlay={() => playerService.togglePlay()}
        />
      </div>

      <div className="fixed bottom-5 left-5 z-30">
        <button
          type="button"
          aria-label={isControlPanelOpen ? "收起播放器控制面板" : "展开播放器控制面板"}
          aria-expanded={isControlPanelOpen}
          onClick={() => setIsControlPanelOpen((open) => !open)}
          className={cn(
            "group flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-black/35 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300",
            isControlPanelOpen
              ? "bg-white/15 text-white"
              : "hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
          )}
        >
          <Music2 className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
        </button>

        <div
          className={cn(
            "absolute bottom-16 left-0 w-64 origin-bottom-left transition-all duration-300",
            isControlPanelOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-3 scale-[0.98] opacity-0"
          )}
        >
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            {/* 大专辑封面 */}
            <div className="relative">
              <div
                className="w-full aspect-square bg-cover bg-center bg-white/5"
                style={currentTrack?.picUrl ? { backgroundImage: `url(${currentTrack.picUrl})` } : undefined}
              >
                {!currentTrack?.picUrl && (
                  <div className="flex h-full items-center justify-center text-white/15">
                    <Music2 className="h-12 w-12" />
                  </div>
                )}
              </div>
              {/* 封面底部渐变 */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
              {/* 关闭按钮 */}
              <button
                type="button"
                aria-label="收起播放器控制面板"
                onClick={() => setIsControlPanelOpen(false)}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/50 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 歌曲信息 */}
            <div className="px-3 pt-2 pb-1">
              <p className="truncate text-sm font-semibold tracking-tight text-white">
                {currentTrack?.name || "未在播放"}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-white/40">
                {currentTrack?.artists || "选择一首歌曲开始播放"}
                {currentTrack?.album ? ` · ${currentTrack.album}` : ""}
              </p>
            </div>

            <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.035] p-1 pl-2">
              <span className="text-[10px] font-medium tracking-[0.14em] text-white/35">歌词</span>
              <Select value={lyricsTheme} onValueChange={(value) => setLyricsTheme(value as typeof lyricsTheme)}>
                <SelectTrigger
                  size="sm"
                  className="h-7 w-28 border-white/10 bg-black/20 text-[11px] text-white/80 hover:bg-black/30 focus-visible:ring-white/20"
                >
                  <SelectValue placeholder="选择样式" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-black/80 text-white backdrop-blur-2xl">
                  {([
                    { id: 'default', label: '默认' },
                    { id: 'pixel', label: '像素' },
                    { id: 'flip', label: '翻牌' },
                    { id: 'galaxy', label: '星系' },
                    { id: 'chat', label: '对话' },
                  ] as const).map(({ id, label }) => (
                    <SelectItem
                      key={id}
                      value={id}
                      className="text-[11px] text-white/70 focus:bg-white/10 focus:text-white data-[state=checked]:text-white"
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 进度条 — 与底部中间胶囊共用 GlassProgressBar，样式一致 */}
            <div className="px-3 pb-1">
              <GlassProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={(time) => playerService.seek(time)}
                labelClassName="text-[9px] text-white/30"
              />
            </div>

            {/* 上一首 / 播放 / 下一首 */}
            <div className="flex items-center justify-center gap-3 px-3 pt-1 pb-2">
              <button
                type="button"
                aria-label="上一首"
                onClick={() => playerService.playPrevious()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SkipBack className="h-4 w-4 fill-current" />
              </button>
              <button
                type="button"
                aria-label={isPlaying ? "暂停" : "播放"}
                onClick={() => playerService.togglePlay()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-white/10 transition-transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </button>
              <button
                type="button"
                aria-label="下一首"
                onClick={() => playerService.playNext()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SkipForward className="h-4 w-4 fill-current" />
              </button>
            </div>

            {/* 底部：喜欢 / 循环 / 音量 */}
            <div className="flex items-center justify-between px-3 pb-3 border-t border-white/5 pt-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="歌曲列表"
                  onClick={() => setShowPlaylist(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/25 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ListMusic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={heartMode ? "取消喜欢" : "喜欢当前歌曲"}
                  onClick={() => {
                    const store = usePlayerStore.getState()
                    store.setHeartMode(!store.heartMode)
                  }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    heartMode ? "text-red-400 hover:bg-red-400/10" : "text-white/25 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Heart className={cn("h-3.5 w-3.5", heartMode && "fill-current")} />
                </button>
                <button
                  type="button"
                  aria-label="切换播放模式"
                  onClick={() => {
                    const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
                    const index = modes.indexOf(repeatMode)
                    setRepeatMode(modes[(index + 1) % modes.length])
                  }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    repeatMode === RepeatMode.Off ? "text-white/25 hover:bg-white/10 hover:text-white" : "text-sky-300/70 hover:bg-sky-300/10"
                  )}
                >
                  {repeatIcon}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={volume === 0 ? "恢复音量" : "静音"}
                  onClick={() => playerService.setVolume(volume > 0 ? 0 : 0.8)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <Slider
                  value={[volume]}
                  max={1}
                  step={0.01}
                  onValueChange={(value) => playerService.setVolume(value[0])}
                  className="w-16 [&_[role=slider]]:border-white/30 [&_[role=slider]]:bg-white [&_.relative>div]:bg-white/60"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 全屏歌曲列表 — 螺旋散点展览馆 */}
      {showPlaylist && (
        <div className="absolute inset-0 z-[130]">
          <FullscreenPlaylistView onBack={() => setShowPlaylist(false)} />
        </div>
      )}
    </div>
  )
}