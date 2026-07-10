"use client"

import React, { useEffect, useRef, useState } from "react"

interface LiquidGlassProps {
  className?: string
  intensity?: number
  blur?: number
  saturate?: number
  edgeHighlight?: number
  lightAngle?: number
  zIndex?: number
}

function smoothStep(a: number, b: number, t: number) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function length(x: number, y: number) {
  return Math.sqrt(x * x + y * y)
}

function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number) {
  const qx = Math.abs(x) - width + radius
  const qy = Math.abs(y) - height + radius
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius
}

let glassIdCounter = 0;

export function LiquidGlass({
  className = "",
  intensity = 38,
  blur = 40,
  saturate = 1.6,
  edgeHighlight = 0.9,
  lightAngle = 135,
  zIndex = -1,
}: LiquidGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [filterId] = useState(() => `liquid-glass-${++glassIdCounter}-${Math.random().toString(36).substr(2, 9)}`)
  const [svgParams, setSvgParams] = useState<{ url: string, scale: number } | null>(null)
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const generateMap = () => {
      const rect = container.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(container)
      let radius = parseFloat(computedStyle.borderRadius)
      if (isNaN(radius)) radius = 24

      const w = Math.ceil(rect.width) || 100
      const h = Math.ceil(rect.height) || 100
      
      const canvas = document.createElement("canvas")
      const dpi = 1
      canvas.width = w * dpi
      canvas.height = h * dpi
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Highlight canvas for specular edge glow
      const hlCanvas = document.createElement("canvas")
      hlCanvas.width = w * dpi
      hlCanvas.height = h * dpi
      const hlCtx = hlCanvas.getContext("2d")

      const data = new Uint8ClampedArray(w * dpi * h * dpi * 4)
      const hlData = hlCtx ? new Uint8ClampedArray(w * dpi * h * dpi * 4) : null
      let maxScale = 0
      const rawValues = new Float32Array(w * dpi * h * dpi * 2)

      const rectW = (w * dpi) / 2
      const rectH = (h * dpi) / 2
      const r = radius * dpi

      // Light direction from lightAngle (degrees)
      const lightRad = (lightAngle * Math.PI) / 180
      const lightX = Math.cos(lightRad)
      const lightY = Math.sin(lightRad)

      let idx = 0
      for (let y = 0; y < h * dpi; y++) {
        for (let x = 0; x < w * dpi; x++) {
          const px = x - rectW
          const py = y - rectH

          const distToEdge = roundedRectSDF(px, py, rectW, rectH, r)
          
          // Compute gradient of SDF (normal pointing outward)
          const step = 1
          const d1 = roundedRectSDF(px + step, py, rectW, rectH, r)
          const d2 = roundedRectSDF(px, py + step, rectW, rectH, r)
          
          let nx = d1 - distToEdge
          let ny = d2 - distToEdge
          const len = Math.sqrt(nx*nx + ny*ny)
          if (len > 0) { nx /= len; ny /= len }

          // Edge refraction zone
          const edgeThickness = 28 * dpi
          
          let distortion = 0
          if (distToEdge <= 0 && distToEdge > -edgeThickness) {
            const t = 1 - Math.abs(distToEdge) / edgeThickness
            // Stronger curve with a sharper falloff for more pronounced edge bending
            distortion = smoothStep(0, 1, t) * smoothStep(0.1, 0.9, t)
          }

          const dx = -nx * distortion * intensity
          const dy = -ny * distortion * intensity

          rawValues[idx] = dx
          rawValues[idx + 1] = dy
          maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))

          // Specular highlight: dot product of normal with light direction
          if (hlData && distToEdge <= 0 && distToEdge > -edgeThickness) {
            const t = 1 - Math.abs(distToEdge) / edgeThickness
            const edgeFactor = smoothStep(0, 1, t)
            // Fresnel-like: stronger at grazing angles
            const dot = nx * lightX + ny * lightY
            const specular = Math.pow(Math.max(0, dot), 2.5) * edgeFactor * edgeHighlight
            // Chromatic: slight color shift for prismatic look
            const pixIdx = (y * w * dpi + x) * 4
            hlData[pixIdx] = Math.min(255, specular * 255 * 1.1)     // R - slightly warm
            hlData[pixIdx + 1] = Math.min(255, specular * 255)       // G
            hlData[pixIdx + 2] = Math.min(255, specular * 255 * 1.2) // B - slightly cool
            hlData[pixIdx + 3] = Math.min(255, specular * 200)       // A
          }

          idx += 2
        }
      }

      // Encode displacement map
      idx = 0
      for (let i = 0; i < data.length; i += 4) {
        const dx = rawValues[idx++]
        const dy = rawValues[idx++]
        const rVal = maxScale > 0 ? (dx / (2 * maxScale)) + 0.5 : 0.5
        const gVal = maxScale > 0 ? (dy / (2 * maxScale)) + 0.5 : 0.5
        data[i] = rVal * 255
        data[i + 1] = gVal * 255
        data[i + 2] = 0
        data[i + 3] = 255
      }

      ctx.putImageData(new ImageData(data, w * dpi, h * dpi), 0, 0)
      setSvgParams({ url: canvas.toDataURL(), scale: maxScale * 2 / dpi })

      // Generate highlight overlay
      if (hlCtx && hlData) {
        hlCtx.putImageData(new ImageData(hlData, w * dpi, h * dpi), 0, 0)
        setHighlightUrl(hlCanvas.toDataURL())
      }
    }

    const timeoutMsg = setTimeout(generateMap, 50)
    
    const observer = new ResizeObserver(() => {
      generateMap()
    })
    observer.observe(container)
    
    return () => {
      clearTimeout(timeoutMsg)
      observer.disconnect()
    }
  }, [intensity, edgeHighlight, lightAngle])

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden ${className}`}
      style={{ zIndex }}
    >
      <div
        className="absolute inset-0 h-full w-full rounded-[inherit]"
        style={{
          backdropFilter: `blur(${blur}px) saturate(${saturate}) brightness(1.05) contrast(1.1)`,
          WebkitBackdropFilter: `blur(${blur}px) saturate(${saturate}) brightness(1.05) contrast(1.1)`,
        }}
      />
      {svgParams && (
        <>
          <svg style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <filter id={filterId} filterUnits="objectBoundingBox" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feImage href={svgParams.url} result="map" width="100%" height="100%" preserveAspectRatio="none" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={svgParams.scale} xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>
          <div
            className="absolute inset-0 h-full w-full rounded-[inherit]"
            style={{
              backdropFilter: `url(#${filterId})`,
              WebkitBackdropFilter: `url(#${filterId})`,
            }}
          />
        </>
      )}
      {highlightUrl && (
        <div
          className="absolute inset-0 h-full w-full rounded-[inherit] mix-blend-screen"
          style={{
            backgroundImage: `url(${highlightUrl})`,
            backgroundSize: '100% 100%',
            opacity: 1,
          }}
        />
      )}
      <div
        className="absolute inset-0 h-full w-full rounded-[inherit]"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.04) 34%, rgba(255,255,255,0) 60%)",
          boxShadow: `inset 1px 1px 2px 0 rgba(255,255,255,${0.2 + edgeHighlight * 0.16}), inset -1px -1px 3px 0 rgba(255,255,255,0.08), inset 0 -12px 22px rgba(0,0,0,0.08)`,
        }}
      />
    </div>
  )
}
