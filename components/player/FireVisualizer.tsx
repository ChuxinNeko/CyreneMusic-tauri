"use client"

import React from "react"
import { audioAnalyser } from "@/lib/services/audioAnalyser"

interface AtmosphereVisualizerProps {
  isPlaying?: boolean
  height?: number | string
  externalBarData?: number[] | null
  themeColor?: string
  colors?: {
    core?: string
    mid?: string
    outer?: string
    glow?: string
  }
  className?: string
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#000"
  ctx.fillStyle = color
  if (ctx.fillStyle === "#000000" && color !== "#000000" && color !== "#000" && color.toLowerCase() !== "black") return null
  const hex = ctx.fillStyle
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function derivePalette(colorStr: string) {
  const c = parseColor(colorStr)
  const r = c?.r ?? 80, g = c?.g ?? 200, b = c?.b ?? 180
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const lum = (max + min) / 510
  const sat = max === min ? 0 : (max - min) / (lum > 0.5 ? 510 - max - min : max + min)
  let hue = 0
  if (max !== min) {
    const d = max - min
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) hue = ((b - r) / d + 2) / 6
    else hue = ((r - g) / d + 4) / 6
  }
  const hsl2rgb = (h: number, s: number, l: number) => {
    h = ((h % 1) + 1) % 1
    if (s === 0) return `${Math.round(l * 255)},${Math.round(l * 255)},${Math.round(l * 255)}`
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hue2rgb = (pp: number, qq: number, t: number) => {
      t = ((t % 1) + 1) % 1
      if (t < 1 / 6) return pp + (qq - pp) * 6 * t
      if (t < 1 / 2) return qq
      if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6
      return pp
    }
    return `${Math.round(hue2rgb(p, q, h + 1 / 3) * 255)},${Math.round(hue2rgb(p, q, h) * 255)},${Math.round(hue2rgb(p, q, h - 1 / 3) * 255)}`
  }
  return {
    deep:    hsl2rgb(hue - 0.03, Math.min(1, sat * 1.1), lum * 0.7),
    primary: `${r},${g},${b}`,
    light:   hsl2rgb(hue + 0.03, sat * 0.9, Math.min(0.85, lum + 0.2)),
    accent:  hsl2rgb(hue + 0.06, sat * 0.5, Math.min(0.92, lum + 0.35)),
  }
}

export function FireVisualizer({
  isPlaying = false,
  height = "100%",
  externalBarData = null,
  themeColor,
  colors = {},
  className = "",
}: AtmosphereVisualizerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef<number>(0)
  const externalDataRef = React.useRef<number[] | null>(externalBarData)
  const isPlayingRef = React.useRef(isPlaying)

  React.useEffect(() => { externalDataRef.current = externalBarData }, [externalBarData])
  React.useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const baseHex = themeColor || colors.core || "#4ECDC4"
  const palette = React.useMemo(() => derivePalette(baseHex), [baseHex])
  const paletteRef = React.useRef(palette)
  React.useEffect(() => { paletteRef.current = palette }, [palette])

  // effect 只在 mount 时运行一次，动画永不停止
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let containerW = 0
    let containerH = 0

    const syncSize = () => {
      const rect = container.getBoundingClientRect()
      containerW = rect.width
      containerH = rect.height
      canvas.width = Math.round(containerW * dpr)
      canvas.height = Math.round(containerH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    syncSize()

    const ro = new ResizeObserver(() => syncSize())
    ro.observe(container)

    // ── 精确复刻 1.html 的 LightOrb 结构 ──
    let orbs = [
      { baseX: 0.20, baseY: 0.90, baseRadius: 0.40, color: paletteRef.current.deep,    speedX: 0.005, speedY: 0.007, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
      { baseX: 0.80, baseY: 0.85, baseRadius: 0.35, color: paletteRef.current.light,   speedX: 0.008, speedY: 0.006, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
      { baseX: 0.50, baseY: 0.70, baseRadius: 0.30, color: paletteRef.current.primary, speedX: 0.006, speedY: 0.009, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
      { baseX: 0.40, baseY: 0.95, baseRadius: 0.25, color: paletteRef.current.accent,  speedX: 0.012, speedY: 0.015, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
    ]
    let prevPalette = paletteRef.current

    let smoothedIntensity = 0

    const animate = () => {
      const w = containerW
      const h = containerH
      if (w < 1 || h < 1) { rafRef.current = requestAnimationFrame(animate); return }

      // palette 变化时更新光球颜色（不重置相位）
      const curPalette = paletteRef.current
      if (curPalette !== prevPalette) {
        orbs[0].color = curPalette.deep
        orbs[1].color = curPalette.light
        orbs[2].color = curPalette.primary
        orbs[3].color = curPalette.accent
        prevPalette = curPalette
      }

      // ── 获取音频强度（0-1）──
      const playing = isPlayingRef.current
      let rawTarget = 0
      const ext = externalDataRef.current
      
      // 我们不再计算所有频段的平均值（因为高频常常为0，会严重拉低平均值导致完全没有律动感）。
      // 取而代之，我们提取主要频段（尤其是低频/中频）的峰值能量，以此来驱动爆发效果。
      if (ext && ext.length > 0) {
        let maxEnergy = 0
        // 只取前一半的频段（低频到中高频），避开极高频的底噪或无声段
        const validLen = Math.floor(ext.length * 0.6)
        for (let i = 0; i < validLen; i++) {
          if (ext[i] > maxEnergy) maxEnergy = ext[i]
        }
        rawTarget = maxEnergy
      } else if (playing) {
        const { bass, mid } = audioAnalyser.getFrequencyData()
        // 结合低频和中频能量，低频占比更大，这样鼓点和人声都能引起光晕爆发
        rawTarget = Math.min(1, bass * 0.8 + mid * 0.4)
      }

      // 平滑缓动
      smoothedIntensity += (rawTarget - smoothedIntensity) * 0.1
      const audioFactor = playing ? smoothedIntensity : smoothedIntensity * 0.3

      // ── 渲染 ──
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = "screen"

      for (const orb of orbs) {
        // 李萨如曲线游动 — 永不停止的基础运动
        orb.timeX += orb.speedX
        orb.timeY += orb.speedY

        const moveX = Math.sin(orb.timeX) * (w * 0.25)
        const moveY = Math.cos(orb.timeY) * (h * 0.15) - (audioFactor * h * 0.2)

        const x = (w * orb.baseX) + moveX
        const y = (h * orb.baseY) + moveY

        // 恢复更强烈的音频驱动半径膨胀：基础 1.0，最大 1.0 + 1.5 = 2.5 倍
        const radius = w * orb.baseRadius * (1 + audioFactor * 1.5)
        if (radius <= 0) continue

        // 恢复更强烈的音频驱动发光强度：静音时保留底色，满能量时强烈发光
        const alphaCore = 0.15 + audioFactor * 0.85
        const alphaMid  = 0.08 + audioFactor * 0.62

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0,   `rgba(${orb.color}, ${alphaCore.toFixed(2)})`)
        gradient.addColorStop(0.5, `rgba(${orb.color}, ${alphaMid.toFixed(2)})`)
        gradient.addColorStop(1,   `rgba(${orb.color}, 0)`)

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      ctx.globalCompositeOperation = "source-over"
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ height: typeof height === 'number' ? `${height}px` : height, pointerEvents: "none" }}>
      <canvas
        ref={canvasRef}
        className="absolute block"
        style={{
          bottom: "-20%",
          left: "-20%",
          width: "140%",
          height: "140%",
          filter: "blur(45px) saturate(150%)",
          mixBlendMode: "screen",
          opacity: 0.9,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}