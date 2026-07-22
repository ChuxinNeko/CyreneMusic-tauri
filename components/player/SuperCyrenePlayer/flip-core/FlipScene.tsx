"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { MotionValue } from "framer-motion"
import * as THREE from "three"
import type { AudioBands, Line, Theme } from "./flip-types"
import { buildLineGraphemeTimeline } from "./flip-graphemeTiming"
import { getLineRenderEndTime } from "./flip-renderHints"
import { resolveThemeFontStack } from "./flip-fontStacks"
import { buildFlipUnits, buildFlipPlacements } from "./flip-layout"
import { buildFlipFontSpec, rasterFlipUnit, type FlipUnitRaster } from "./flip-textRaster"
import type { FlipTuning, FlipVisibleLine } from "./flip-types"
import { DEFAULT_FLIP_TUNING } from "./flip-types"

// ── 布局常量 ──
const LINES_AHEAD = 2
const LINES_BEHIND = 1
const FLIP_ANTICIPATION = 0.06
const COLOR_DAMP_RATE = 1.2
const FOG_NEAR = 8
const FOG_FAR = 25

// ── 工具函数 ──
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const smoothstep = (t: number): number => { const c = clamp01(t); return c * c * (3 - 2 * c) }

const resolveNeighborOpacity = (offset: number): number => {
  if (offset === -1) return 0.3
  if (offset === -2) return 0.1
  if (offset === 1) return 0.34
  if (offset === 2) return 0.16
  return 0
}

/**
 * 计算单张翻牌的 X 轴旋转角。
 *
 * -π / π = 背面朝向相机（隐藏）
 * 0      = 正面朝向相机（显示文字）
 *
 * 翻入：-π → 0（顺时针翻入）
 * 翻出：0  → π（顺时针翻出，与翻入同方向，视觉连贯）
 */
const computeCardRotation = (
  now: number,
  unit: { startTime: number; endTime: number },
  lineRenderEnd: number,
  tuning: FlipTuning,
): number => {
  const flipStart = unit.startTime - FLIP_ANTICIPATION

  if (now < flipStart) return -Math.PI
  if (now < unit.endTime) {
    const t = clamp01((now - flipStart) / (unit.endTime - flipStart))
    return -Math.PI + Math.PI * smoothstep(t)
  }
  if (now < lineRenderEnd + tuning.flipBackDelay) return 0
  const backT = clamp01((now - (lineRenderEnd + tuning.flipBackDelay)) / tuning.flipDuration)
  return Math.PI * smoothstep(backT)
}

interface DampedColors {
  primary: THREE.Color
  accent: THREE.Color
  secondary: THREE.Color
  bg: THREE.Color
}

interface FlipSceneProps {
  lines: Line[]
  currentLineIndex: number
  currentTime: MotionValue<number>
  theme: Theme
  audioBands: AudioBands
  audioPower: MotionValue<number>
  showLyrics: boolean
  tuning?: FlipTuning
  lyricsFontScale?: number
}

const FlipScene: React.FC<FlipSceneProps> = ({
  lines, currentLineIndex, currentTime, theme, audioBands, audioPower,
  showLyrics, tuning = DEFAULT_FLIP_TUNING, lyricsFontScale = 1,
}) => {
  const scrollGroupRef = useRef<THREE.Group>(null)
  const scrollYRef = useRef(0)
  const cardGroupRefs = useRef<Map<string, THREE.Group>>(new Map())
  const frontMatRefs = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map())
  const backMatRefs = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map())
  const glowMatRefs = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map())
  const rasterCacheRef = useRef<Map<string, FlipUnitRaster>>(new Map())
  const prevFontSpecRef = useRef("")
  const dampedColorsRef = useRef<DampedColors | null>(null)
  const powerEnvRef = useRef(0)

  // ── 字体加载 ──
  const [fontsEpoch, setFontsEpoch] = useState(0)
  useEffect(() => {
    let mounted = true
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => { if (mounted) setFontsEpoch(e => e + 1) })
    }
    return () => { mounted = false }
  }, [])
  const fontStack = useMemo(
    () => resolveThemeFontStack(theme),
    [theme.fontStyle, theme.fontFamily, fontsEpoch],
  )
  const fontSpec = useMemo(() => buildFlipFontSpec(fontStack), [fontStack])

  // ── 颜色目标 ──
  const colorTargets = useMemo<DampedColors>(() => ({
    primary: new THREE.Color(theme.primaryColor),
    accent: new THREE.Color(theme.accentColor || theme.primaryColor),
    secondary: new THREE.Color(theme.secondaryColor),
    bg: new THREE.Color(theme.backgroundColor),
  }), [theme.primaryColor, theme.accentColor, theme.secondaryColor, theme.backgroundColor])

  // ── 雾 ──
  const scene = useThree(state => state.scene)
  useEffect(() => {
    const prev = scene.fog
    scene.fog = new THREE.Fog(colorTargets.bg.getHex(), FOG_NEAR, FOG_FAR)
    return () => { scene.fog = prev }
  }, [scene, colorTargets.bg])

  // ── 栅格缓存 ──
  const getUnitRaster = (text: string, spec: string): FlipUnitRaster => {
    const key = `${spec}\0${text}`
    let raster = rasterCacheRef.current.get(key)
    if (!raster) {
      raster = rasterFlipUnit(text, spec)
      rasterCacheRef.current.set(key, raster)
    }
    return raster
  }

  // 字体变化时清理旧纹理
  useEffect(() => {
    if (prevFontSpecRef.current && prevFontSpecRef.current !== fontSpec) {
      rasterCacheRef.current.forEach(r => r.texture.dispose())
      rasterCacheRef.current.clear()
    }
    prevFontSpecRef.current = fontSpec
  }, [fontSpec])

  // 卸载时清理全部纹理
  useEffect(() => () => {
    rasterCacheRef.current.forEach(r => r.texture.dispose())
    rasterCacheRef.current.clear()
  }, [])

  // ── 可见行预计算 ──
  const visibleLines = useMemo<FlipVisibleLine[]>(() => {
    const start = Math.max(0, currentLineIndex - LINES_BEHIND)
    const end = Math.min(lines.length - 1, currentLineIndex + LINES_AHEAD)
    const result: FlipVisibleLine[] = []
    for (let i = start; i <= end; i++) {
      const line = lines[i]
      if (!line?.fullText) continue
      const timeline = buildLineGraphemeTimeline(line)
      const units = buildFlipUnits(line, timeline)
      if (units.length === 0) continue
      const placements = buildFlipPlacements(units, line.fullText, fontSpec)
      result.push({ index: i, line, units, placements })
    }
    return result
  }, [lines, currentLineIndex, fontSpec])

  // ── 帧循环 ──
  useFrame((state, delta) => {
    // 颜色阻尼
    if (!dampedColorsRef.current) {
      dampedColorsRef.current = {
        primary: colorTargets.primary.clone(),
        accent: colorTargets.accent.clone(),
        secondary: colorTargets.secondary.clone(),
        bg: colorTargets.bg.clone(),
      }
    }
    const damped = dampedColorsRef.current
    const colorK = 1 - Math.exp(-COLOR_DAMP_RATE * delta)
    damped.primary.lerp(colorTargets.primary, colorK)
    damped.accent.lerp(colorTargets.accent, colorK)
    damped.secondary.lerp(colorTargets.secondary, colorK)
    damped.bg.lerp(colorTargets.bg, colorK)
    const sceneFog = state.scene.fog
    if (sceneFog instanceof THREE.Fog) sceneFog.color.copy(damped.bg)

    // 音频包络
    const power01 = Math.min(1, audioPower.get() / 255)
    powerEnvRef.current += (power01 - powerEnvRef.current) * (1 - Math.exp(-12 * delta))

    // 滚动跟随
    const targetY = -currentLineIndex * tuning.lineSpacing
    scrollYRef.current += (targetY - scrollYRef.current) * (1 - Math.exp(-6 * delta))
    if (scrollGroupRef.current) {
      scrollGroupRef.current.position.y = scrollYRef.current
    }

    // 翻牌动画
    const now = currentTime.get()
    const breath = 0.9 + 0.1 * Math.sin(state.clock.elapsedTime * 1.9)

    visibleLines.forEach(({ index, line, units }) => {
      const isActive = index === currentLineIndex
      const offset = index - currentLineIndex
      const lineRenderEnd = getLineRenderEndTime(line)
      const baseOpacity = isActive ? 1 : resolveNeighborOpacity(offset)
      const lineColor = offset < 0 ? damped.primary : (offset > 0 ? damped.secondary : damped.primary)

      units.forEach((unit, i) => {
        const key = `${index}-${i}`
        const group = cardGroupRefs.current.get(key)
        if (!group) return

        const rotation = computeCardRotation(now, unit, lineRenderEnd, tuning)
        group.rotation.x = rotation

        const isFrontFacing = Math.abs(rotation) < Math.PI * 0.5
        const isBackFacing = !isFrontFacing && Math.abs(rotation) > Math.PI * 0.5
        const sung = now >= unit.endTime
        const isCurrent = now >= unit.startTime && now < unit.endTime
        const sungMix = sung ? 1 : isCurrent
          ? clamp01((now - unit.startTime) / Math.max(unit.endTime - unit.startTime, 0.001))
          : 0

        // Skip material updates for back-facing cards that are not the active
        // line — they're invisible anyway. This avoids 3x Map.get + 3x
        // color.copy + 3x opacity write per invisible card per frame.
        const needsMaterialUpdate = isActive || (isFrontFacing && baseOpacity > 0.01)

        if (needsMaterialUpdate) {
          const frontMat = frontMatRefs.current.get(key)
          if (frontMat) {
            const targetFrontOpacity = baseOpacity * (0.5 + 0.5 * sungMix) * (isFrontFacing ? 1 : 0)
            if (frontMat.opacity !== targetFrontOpacity) frontMat.opacity = targetFrontOpacity
            frontMat.color.copy(lineColor)
          }

          const backMat = backMatRefs.current.get(key)
          if (backMat && backMat.opacity !== baseOpacity * 0.12) {
            backMat.opacity = baseOpacity * 0.12
            backMat.color.copy(damped.secondary)
          }

          const glowMat = glowMatRefs.current.get(key)
          if (glowMat) {
            const glowLevel = isActive && isCurrent
              ? breath * (0.6 + 0.4 * powerEnvRef.current) * tuning.glowIntensity
              : 0
            const targetGlowOpacity = Math.min(1, 0.9 * glowLevel)
            if (glowMat.opacity !== targetGlowOpacity) {
              glowMat.opacity = targetGlowOpacity
              glowMat.color.copy(damped.accent)
            }
          }
        }
      })
    })
  })

  // ── 渲染 ──
  const colors = useMemo(() => ({
    primary: theme.primaryColor,
    accent: theme.accentColor || theme.primaryColor,
    secondary: theme.secondaryColor,
  }), [theme.primaryColor, theme.accentColor, theme.secondaryColor])

  return (
    <group ref={scrollGroupRef}>
      {showLyrics && visibleLines.map(({ index, units, placements }) => (
        <group key={index} position={[0, index * tuning.lineSpacing, 0]}>
          <group scale={lyricsFontScale}>
            {units.map((unit, i) => {
              const raster = getUnitRaster(unit.text, fontSpec)
              const placement = placements[i]
              if (!placement) return null
              const refKey = `${index}-${i}`
              return (
                <group
                  key={i}
                  position={[placement.centerX, 0, 0]}
                  ref={el => { if (el) cardGroupRefs.current.set(refKey, el); else cardGroupRefs.current.delete(refKey) }}
                >
                  {/* Glow: 辉光层，仅正面朝相机时可见 */}
                  <mesh position={[0, 0, -0.02]} renderOrder={0}>
                    <planeGeometry args={[placement.width * 1.25, placement.height * 1.25]} />
                    <meshBasicMaterial
                      ref={el => { if (el) glowMatRefs.current.set(refKey, el); else glowMatRefs.current.delete(refKey) }}
                      transparent
                      opacity={0}
                      depthTest={false}
                      depthWrite={false}
                      blending={THREE.AdditiveBlending}
                      side={THREE.FrontSide}
                    />
                  </mesh>
                  {/* Back: 翻牌背面（暗色），rotation y=π 使法线指向 -z */}
                  <mesh position={[0, 0, -0.01]} rotation={[0, Math.PI, 0]} renderOrder={1}>
                    <planeGeometry args={[placement.width, placement.height]} />
                    <meshBasicMaterial
                      ref={el => { if (el) backMatRefs.current.set(refKey, el); else backMatRefs.current.delete(refKey) }}
                      transparent
                      opacity={0.12}
                      depthWrite={false}
                      side={THREE.FrontSide}
                      color={colors.secondary}
                    />
                  </mesh>
                  {/* Front: 翻牌正面（文字纹理） */}
                  <mesh position={[0, 0, 0.01]} renderOrder={2}>
                    <planeGeometry args={[placement.width, placement.height]} />
                    <meshBasicMaterial
                      ref={el => { if (el) frontMatRefs.current.set(refKey, el); else frontMatRefs.current.delete(refKey) }}
                      map={raster.texture}
                      transparent
                      opacity={0.5}
                      depthWrite={false}
                      side={THREE.FrontSide}
                      color={colors.primary}
                    />
                  </mesh>
                </group>
              )
            })}
          </group>
        </group>
      ))}
    </group>
  )
}

export default FlipScene