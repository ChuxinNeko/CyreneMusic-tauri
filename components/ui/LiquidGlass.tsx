"use client"

import React, { useEffect, useRef, useState } from "react"

interface LiquidGlassProps {
  className?: string
  intensity?: number
  blur?: number
  saturate?: number
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
  intensity = 30, // max pixel displacement
  blur = 40,
  saturate = 1.5
}: LiquidGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [filterId] = useState(() => `liquid-glass-${++glassIdCounter}-${Math.random().toString(36).substr(2, 9)}`)
  const [svgParams, setSvgParams] = useState<{ url: string, scale: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const generateMap = () => {
      // Use offsetWidth/offsetHeight for integer pixels, or getBoundingClientRect
      const rect = container.getBoundingClientRect()
      // We calculate rounded corners from computed style
      const computedStyle = window.getComputedStyle(container)
      let radius = parseFloat(computedStyle.borderRadius)
      if (isNaN(radius)) radius = 24 // default fallback

      const w = Math.ceil(rect.width) || 100
      const h = Math.ceil(rect.height) || 100
      
      const canvas = document.createElement("canvas")
      // Increase resolution slightly for better map detail
      const dpi = 1
      canvas.width = w * dpi
      canvas.height = h * dpi
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const data = new Uint8ClampedArray(w * dpi * h * dpi * 4)
      let maxScale = 0
      const rawValues = new Float32Array(w * dpi * h * dpi * 2)

      // The SDF needs to run in pixel space to maintain 1:1 aspect ratio on the corners
      const rectW = (w * dpi) / 2
      const rectH = (h * dpi) / 2
      const r = radius * dpi

      let idx = 0
      for (let y = 0; y < h * dpi; y++) {
        for (let x = 0; x < w * dpi; x++) {
          const px = x - rectW
          const py = y - rectH

          // Calculate distance to edge
          const distToEdge = roundedRectSDF(px, py, rectW, rectH, r)
          
          // Inside the glass, distToEdge is <= 0.
          // The edge refraction typically happens near the border.
          // Let's create a displacement vector.
          
          // Compute gradient of SDF (which points outwards)
          const step = 1
          const d1 = roundedRectSDF(px + step, py, rectW, rectH, r)
          const d2 = roundedRectSDF(px, py + step, rectW, rectH, r)
          
          let nx = d1 - distToEdge
          let ny = d2 - distToEdge
          const len = Math.sqrt(nx*nx + ny*ny)
          if (len > 0) { nx /= len; ny /= len }

          // Refraction magnitude.
          // At the border (dist = 0), magnitude is high.
          // As we go inwards (dist < 0), magnitude decreases.
          // We define a thick edge.
          const edgeThickness = 30 * dpi
          
          let distortion = 0
          if (distToEdge <= 0 && distToEdge > -edgeThickness) {
            // scale 0 to 1 where 0 is inner boundary and 1 is outer edge
            const t = 1 - Math.abs(distToEdge) / edgeThickness
            // Smooth curve
            distortion = smoothStep(0, 1, t)
          }

          // Offset direction. Light from background is bent.
          // Displacing opposite to normal vector creates a convex magnification near the edge.
          const dx = -nx * distortion * intensity
          const dy = -ny * distortion * intensity

          rawValues[idx++] = dx
          rawValues[idx++] = dy
          maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
        }
      }

      // Encode into RGBA where R=X map, G=Y map
      idx = 0
      for (let i = 0; i < data.length; i += 4) {
        const dx = rawValues[idx++]
        const dy = rawValues[idx++]
        // Convert to 0..1 then 0..255
        const rVal = maxScale > 0 ? (dx / (2 * maxScale)) + 0.5 : 0.5
        const gVal = maxScale > 0 ? (dy / (2 * maxScale)) + 0.5 : 0.5
        data[i] = rVal * 255
        data[i + 1] = gVal * 255
        data[i + 2] = 0
        data[i + 3] = 255
      }

      ctx.putImageData(new ImageData(data, w * dpi, h * dpi), 0, 0)
      setSvgParams({ url: canvas.toDataURL(), scale: maxScale * 2 / dpi })
    }

    // Delay generation slightly to ensure computed styles (like radius) are loaded
    const timeoutMsg = setTimeout(generateMap, 50)
    
    // Listen to resize
    const observer = new ResizeObserver(() => {
      generateMap()
    })
    observer.observe(container)
    
    return () => {
      clearTimeout(timeoutMsg)
      observer.disconnect()
    }
  }, [intensity])

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden ${className}`}
      style={{ zIndex: -1 }}
    >
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
            className="absolute inset-0 w-full h-full rounded-[inherit]"
            style={{ 
              backdropFilter: `url(#${filterId}) blur(${blur}px) saturate(${saturate}) brightness(1.05) contrast(1.1)`, 
              WebkitBackdropFilter: `url(#${filterId}) blur(${blur}px) saturate(${saturate}) brightness(1.05) contrast(1.1)` 
            }}
          />
        </>
      )}
    </div>
  )
}
