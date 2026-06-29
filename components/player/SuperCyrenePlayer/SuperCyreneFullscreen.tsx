"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { usePlayerStore, RepeatMode } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { audioAnalyser, type FrequencyData } from "@/lib/services/audioAnalyser"
import { Minimize2, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, VolumeX, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import dynamic from "next/dynamic"

const ParticleAlbumCover = dynamic(
  () => import("./ParticleAlbumCover").then((m) => m.ParticleAlbumCover),
  { ssr: false }
)

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

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
  const queue = usePlayerStore((s) => s.queue)

  const [frequency, setFrequency] = useState<FrequencyData>({ bass: 0, mid: 0, treble: 0 })
  const [beat, setBeat] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const beatDecayRef = useRef(0)
  const prevBassRef = useRef(0)

  // 音频分析循环
  useEffect(() => {
    if (!isVisible) return
    let raf: number
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const data = audioAnalyser.getFrequencyData()
      if (data) {
        setFrequency(data)

        // 节拍检测: 低频突变
        const bassRise = Math.max(0, data.bass - prevBassRef.current)
        prevBassRef.current = data.bass * 0.7 + prevBassRef.current * 0.3

        if (bassRise > 0.08) {
          beatDecayRef.current = Math.min(1, bassRise * 3.5)
        } else {
          beatDecayRef.current *= 0.88
        }
        setBeat(beatDecayRef.current)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isVisible])

  // 全屏状态同步
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

  const handleProgressChange = useCallback((val: number[]) => {
    const p = val[0]
    if (isDraggingProgress) {
      setDragProgress(p)
    }
  }, [isDraggingProgress])

  const handleProgressCommit = useCallback((val: number[]) => {
    const p = val[0]
    playerService.seek(p)
    setIsDraggingProgress(false)
  }, [])

  const displayProgress = isDraggingProgress ? dragProgress : currentTime
  const displayDuration = duration || 1
  const progressPercent = (displayProgress / displayDuration) * 100

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
      {/* 退出按钮 */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 backdrop-blur-md
                     flex items-center justify-center text-white/60 hover:text-white
                     hover:bg-white/10 hover:border-white/20 transition-all"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 主体: 粒子封面居中 */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* 模糊背景 */}
        {currentTrack?.picUrl && (
          <div
            className="absolute inset-0 opacity-20 blur-[80px] scale-150"
            style={{
              backgroundImage: `url(${currentTrack.picUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        {/* 3D 粒子封面 */}
        <div className="relative w-full h-full max-w-[70vh] max-h-[70vh] mx-auto my-auto">
          <ParticleAlbumCover
            coverUrl={currentTrack?.picUrl ?? null}
            frequency={frequency}
            beat={beat}
            isPlaying={isPlaying}
          />
        </div>
      </div>

      {/* 底部控制区 */}
      <div
        className={cn(
          "relative z-10 px-8 pb-8 pt-4 transition-all duration-500 delay-100",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        {/* 歌曲信息 */}
        <div className="text-center mb-5">
          <h2 className="text-white text-xl font-semibold tracking-tight truncate max-w-lg mx-auto">
            {currentTrack?.name || "未在播放"}
          </h2>
          <p className="text-white/40 text-sm mt-1 truncate max-w-md mx-auto">
            {currentTrack?.artists}
            {currentTrack?.album ? ` · ${currentTrack.album}` : ""}
          </p>
        </div>

        {/* 进度条 */}
        <div className="max-w-xl mx-auto mb-5 flex items-center gap-3">
          <span className="text-white/30 text-xs font-mono w-10 text-right tabular-nums">
            {formatTime(displayProgress)}
          </span>
          <Slider
            value={[isDraggingProgress ? dragProgress : currentTime]}
            max={duration || 1}
            step={0.1}
            onValueChange={handleProgressChange}
            onPointerDown={() => {
              setIsDraggingProgress(true)
              setDragProgress(currentTime)
            }}
            onValueCommit={handleProgressCommit}
            className="flex-1 [&_[role=slider]]:bg-white [&_[role=slider]]:border-white/20
                       [&_.relative>div]:bg-white/80"
          />
          <span className="text-white/30 text-xs font-mono w-10 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={() => {
              const store = usePlayerStore.getState()
              store.setHeartMode(!store.heartMode)
            }}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all",
              heartMode
                ? "text-red-400 hover:text-red-300"
                : "text-white/30 hover:text-white/60"
            )}
          >
            <Heart className={cn("w-4.5 h-4.5", heartMode && "fill-current")} />
          </button>

          <button
            onClick={() => playerService.playPrevious()}
            className="w-10 h-10 rounded-full flex items-center justify-center
                       text-white/50 hover:text-white transition-all"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => playerService.togglePlay()}
            className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/15
                       flex items-center justify-center text-white
                       hover:bg-white/20 hover:border-white/25 hover:scale-105
                       active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => playerService.playNext()}
            className="w-10 h-10 rounded-full flex items-center justify-center
                       text-white/50 hover:text-white transition-all"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => {
              const modes = [RepeatMode.All, RepeatMode.One, RepeatMode.Shuffle]
              const idx = modes.indexOf(repeatMode)
              setRepeatMode(modes[(idx + 1) % modes.length])
            }}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all",
              repeatMode === RepeatMode.Off
                ? "text-white/30 hover:text-white/60"
                : "text-primary hover:text-primary/80"
            )}
          >
            {repeatIcon}
          </button>
        </div>

        {/* 音量 */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => playerService.setVolume(volume > 0 ? 0 : 0.8)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={(v) => playerService.setVolume(v[0])}
            className="w-28 [&_[role=slider]]:bg-white [&_[role=slider]]:border-white/20
                       [&_.relative>div]:bg-white/50"
          />
        </div>
      </div>
    </div>
  )
}