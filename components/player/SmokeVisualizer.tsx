"use client"

import React from "react"
import { audioAnalyser } from "@/lib/services/audioAnalyser"

interface SmokeVisualizerProps {
  isPlaying?: boolean
  height?: number | string
  externalBarData?: number[] | null
  themeColor?: string
  className?: string
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (typeof document === 'undefined') return { r: 80, g: 200, b: 180 }
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
  // Default to a mint/cyan if no color parsed
  const r = c?.r ?? 50, g = c?.g ?? 200, b = c?.b ?? 180
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
    if (s === 0) return `${Math.round(l * 255)}, ${Math.round(l * 255)}, ${Math.round(l * 255)}`
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hue2rgb = (pp: number, qq: number, t: number) => {
      t = ((t % 1) + 1) % 1
      if (t < 1 / 6) return pp + (qq - pp) * 6 * t
      if (t < 1 / 2) return qq
      if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6
      return pp
    }
    return `${Math.round(hue2rgb(p, q, h + 1 / 3) * 255)}, ${Math.round(hue2rgb(p, q, h) * 255)}, ${Math.round(hue2rgb(p, q, h - 1 / 3) * 255)}`
  }
  
  // 核心修复：
  // 1. 滤色混合 (screen) 如果亮度太高会变白，如果亮度太低（深色封面）会完全隐形。
  //    因此我们将亮度 (Lightness) 强制钳制在 0.25 ~ 0.40 之间。
  // 2. 对于有色彩的封面，强制提高饱和度保证光晕鲜艳；但对于黑白/灰度封面，保留它的无色状态（呈现出高级的银白色光雾）。
  
  const safeLum = Math.max(0.25, Math.min(0.4, lum)) // 强制亮度在 0.25-0.4 之间
  const safeSat = sat > 0.05 ? Math.max(0.6, sat) : sat // 仅对非灰度封面强制提升饱和度

  return {
    deep:    hsl2rgb(hue - 0.05, Math.min(1, safeSat * 1.2), safeLum * 0.8), // 主导基色 (最暗)
    primary: hsl2rgb(hue + 0.05, safeSat, safeLum * 1.1), // 明亮高光
    light:   hsl2rgb(hue, safeSat * 0.9, safeLum * 1.2), // 连接两侧
    accent:  hsl2rgb(hue + 0.1, safeSat * 0.8, safeLum * 1.3), // 耀眼节奏点
  }
}

export function SmokeVisualizer({
  isPlaying = false,
  height = "100%",
  externalBarData = null,
  themeColor = "#4ECDC4",
  className = "",
}: SmokeVisualizerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef<number>(0)
  const externalDataRef = React.useRef<number[] | null>(externalBarData)
  const isPlayingRef = React.useRef(isPlaying)

  React.useEffect(() => { externalDataRef.current = externalBarData }, [externalBarData])
  React.useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const palette = React.useMemo(() => derivePalette(themeColor), [themeColor])
  const paletteRef = React.useRef(palette)
  React.useEffect(() => { paletteRef.current = palette }, [palette])

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
      // 获取容器实际大小，并放大以满足 -20% 到 140% 的渲染需求
      const rect = container.getBoundingClientRect()
      containerW = rect.width * 1.4
      containerH = rect.height * 1.4
      canvas.width = Math.round(containerW * dpr)
      canvas.height = Math.round(containerH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    syncSize()

    const ro = new ResizeObserver(() => syncSize())
    ro.observe(container)

    let orbs = [
      // 整体把 baseY 往下压 (向1.0靠近)，并把 baseRadius 缩小
      { baseX: 0.20, baseY: 1.05, baseRadius: 0.30, colorKey: 'deep' as const,    speedX: 0.005, speedY: 0.007, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
      { baseX: 0.80, baseY: 1.00, baseRadius: 0.25, colorKey: 'primary' as const, speedX: 0.008, speedY: 0.006, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
      { baseX: 0.50, baseY: 0.90, baseRadius: 0.20, colorKey: 'light' as const,   speedX: 0.006, speedY: 0.009, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
      { baseX: 0.40, baseY: 1.10, baseRadius: 0.15, colorKey: 'accent' as const,  speedX: 0.012, speedY: 0.015, timeX: Math.random() * 1000, timeY: Math.random() * 1000 },
    ]

    let smoothedIntensity = 0

    const animate = () => {
      const w = containerW
      const h = containerH
      if (w < 1 || h < 1) { rafRef.current = requestAnimationFrame(animate); return }

      const playing = isPlayingRef.current
      let rawTarget = 0
      const ext = externalDataRef.current
      
      if (ext && ext.length > 0) {
        // 由于数据被压缩，我们需要寻找“最大峰值”而不是“平均值”
        // 因为即使有鼓点，平均值也会被其他安静的频段拉低。
        let maxBass = 0;
        const bassLen = Math.max(1, Math.floor(ext.length * 0.2)); 
        for (let i = 0; i < bassLen; i++) {
            if (ext[i] > maxBass) maxBass = ext[i];
        }
        
        let maxMid = 0;
        const midLen = Math.max(1, Math.floor(ext.length * 0.4)); 
        for (let i = bassLen; i < bassLen + midLen; i++) {
            if (i < ext.length && ext[i] > maxMid) maxMid = ext[i];
        }

        // 对最大峰值进行高次方运算，将 0.85~1.0 的范围强行拉开
        // maxBass = 1.0 -> 1.0
        // maxBass = 0.95 -> 0.35
        // maxBass = 0.9 -> 0.12
        let bassEnergy = Math.pow(maxBass, 20); 
        let midEnergy = Math.pow(maxMid, 12);

        rawTarget = bassEnergy * 0.8 + midEnergy * 0.2;
        
        if (rawTarget < 0.05) rawTarget = 0;
        
      } else if (playing) {
        const { bass, mid } = audioAnalyser.getFrequencyData()
        rawTarget = Math.min(1, Math.pow(bass, 2) * 0.8 + Math.pow(mid, 2) * 0.4)
      }

      // 平滑系数调整
      smoothedIntensity += (rawTarget - smoothedIntensity) * 0.3
      const audioFactor = playing ? smoothedIntensity : smoothedIntensity * 0.3

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = "screen"

      const currentPalette = paletteRef.current

      for (const orb of orbs) {
        orb.timeX += orb.speedX
        orb.timeY += orb.speedY

        // 取消左右移动，固定水平位置
        const moveX = 0 
        // 降低垂直跳跃幅度和基础漂移幅度，防止跑到太上面
        const moveY = Math.cos(orb.timeY) * (h * 0.10) - (audioFactor * h * 0.2)

        const x = (w * orb.baseX) + moveX
        const y = (h * orb.baseY) + moveY

        // 减小体积膨胀的最高倍率：从 2.5 降低到 1.5 倍
        const radius = w * orb.baseRadius * (1 + audioFactor * 1.5)
        if (radius <= 0) continue

        const colorStr = currentPalette[orb.colorKey]
        
        // 让静音时更暗 (0.3->0.15)，爆发时更亮 (0.3+0.7->0.15+0.85)
        const alphaCore = 0.15 + audioFactor * 0.85
        const alphaMid  = 0.05 + audioFactor * 0.55

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0,   `rgba(${colorStr}, ${alphaCore.toFixed(2)})`)
        gradient.addColorStop(0.5, `rgba(${colorStr}, ${alphaMid.toFixed(2)})`)
        gradient.addColorStop(1,   `rgba(${colorStr}, 0)`)

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
