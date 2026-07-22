"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { MotionValue } from "framer-motion"
import * as THREE from "three"
import type { AudioBands, GalaxyTuning, GalaxyVisibleLine, Line, Theme } from "./galaxy-types"
import { DEFAULT_GALAXY_TUNING } from "./galaxy-types"
import { buildLineGraphemeTimeline } from "./galaxy-graphemeTiming"
import { getLineRenderEndTime } from "./galaxy-renderHints"
import { resolveThemeFontStack } from "./galaxy-fontStacks"
import { buildGalaxyUnits, buildGalaxyPlacements, measureLineWidth } from "./galaxy-layout"
import { buildGalaxyFontSpec, rasterGalaxyUnit, type GalaxyUnitRaster } from "./galaxy-textRaster"
import {
  clamp01, smoothstep, easeOutBack, graphemeGlowEnvelope,
  spiralPosition, pastArmAngle, futureArmAngle, lineAngularSpread,
  seededRandom, arcCurveZ,
} from "./galaxy-math"
import { createStarfieldGeometry, createStarfieldMaterial, type StarfieldUniforms } from "./galaxy-starfield"
import { deriveGalaxyPalette, clonePalette, lerpPalette, type GalaxyPalette } from "./galaxy-palette"

// ── 布局常量 ──
/** 向后保留的已唱行数（沿近侧旋臂漂散） */
const LINES_BEHIND = 3
/** 向前预显示的行数（沿远侧旋臂等待） */
const LINES_AHEAD = 2
/** 可读行最大宽度（世界单位），超出的行自动等比缩小 */
const MAX_READABLE_WIDTH = 5.6
const COLOR_DAMP_RATE = 1.2
const FOG_NEAR = 9
const FOG_FAR = 30
/** 色板切换（切歌换色）的阻尼速率 */
const PALETTE_DAMP_RATE = 1.6
/** 字符位置阻尼追踪速率（越大越快到位） */
const POS_DAMP_RATE = 8
/** 逐字辉光在演唱开始前提前淡入的时间窗（秒） */
const GLOW_FADE_IN = 0.1
/** 逐字辉光在演唱结束后拖尾淡出的时间窗（秒），越大余晖越长 */
const GLOW_FADE_OUT = 0.5
/** 已唱字残留的常驻微光（避免辉光完全归零，保留一丝存在感） */
const GLOW_RESIDUAL = 0.12

// ── 星云配置 ──
const NEBULA_THETAS = [1.2, 3.4, 5.3]
const NEBULA_SCALES = [5.5, 4.2, 6.5]

// ── 工具函数 ──
const hashSeed = (seed: string | number | undefined): number => {
  if (seed === undefined) return 0x5eed
  if (typeof seed === "number") return seed | 0
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0
  return h
}

/** 径向渐变纹理（星系核心 / 星云 sprite 共用） */
const createRadialGlowTexture = (): THREE.CanvasTexture => {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.25, "rgba(255,255,255,0.5)")
  grad.addColorStop(0.6, "rgba(255,255,255,0.1)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

interface GalaxySceneProps {
  lines: Line[]
  currentLineIndex: number
  currentTime: MotionValue<number>
  theme: Theme
  audioBands: AudioBands
  audioPower: MotionValue<number>
  showLyrics: boolean
  tuning?: GalaxyTuning
  lyricsFontScale?: number
  seed?: string | number
  /** 星系主色相（度），由封面派生 */
  hue?: number
}

/**
 * 螺旋星系歌词场景
 *
 * 视觉叙事：
 * - 当前行在星系核心汇聚成可读弧面，逐字弹入（easeOutBack）
 * - 已唱行沿近侧旋臂向外、向上漂散（回忆远去）
 * - 未来行沿远侧旋臂在银盘下方盘旋等待（星光汇聚）
 * - 背景星尘做较差自转 + bass 脉动，核心辉光随音频呼吸
 */
const GalaxyScene: React.FC<GalaxySceneProps> = ({
  lines, currentLineIndex, currentTime, theme, audioBands, audioPower,
  showLyrics, tuning = DEFAULT_GALAXY_TUNING, lyricsFontScale = 1, seed, hue = 258,
}) => {
  const unitGroupRefs = useRef<Map<string, THREE.Group>>(new Map())
  const mainMatRefs = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map())
  const glowMatRefs = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map())
  const nebulaRefs = useRef<(THREE.Sprite | null)[]>([])
  const coreGlowRef = useRef<THREE.Sprite>(null)
  const starfieldRef = useRef<THREE.Points>(null)
  const rasterCacheRef = useRef<Map<string, GalaxyUnitRaster>>(new Map())
  const prevFontSpecRef = useRef("")
  const dampedPaletteRef = useRef<GalaxyPalette | null>(null)
  const powerEnvRef = useRef(0)
  const driftRef = useRef(0)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.fontStyle, theme.fontFamily, fontsEpoch],
  )
  const fontSpec = useMemo(() => buildGalaxyFontSpec(fontStack), [fontStack])

  // ── 颜色目标（由封面主色相派生的分层色板）──
  const paletteTarget = useMemo<GalaxyPalette>(() => deriveGalaxyPalette(hue), [hue])

  // ── 雾（用深空色作基调，营造纵深；随色板阻尼过渡）──
  const scene = useThree(state => state.scene)
  useEffect(() => {
    const prev = scene.fog
    scene.fog = new THREE.Fog(paletteTarget.deepSpace.getHex(), FOG_NEAR, FOG_FAR)
    return () => { scene.fog = prev }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  // ── 栅格缓存 ──
  const getUnitRaster = (text: string, spec: string): GalaxyUnitRaster => {
    const key = `${spec}\0${text}`
    let raster = rasterCacheRef.current.get(key)
    if (!raster) {
      raster = rasterGalaxyUnit(text, spec)
      rasterCacheRef.current.set(key, raster)
    }
    return raster
  }

  // 字体变化时清理旧纹理
  useEffect(() => {
    if (prevFontSpecRef.current && prevFontSpecRef.current !== fontSpec) {
      rasterCacheRef.current.forEach(r => { r.texture.dispose(); r.glowTexture.dispose() })
      rasterCacheRef.current.clear()
    }
    prevFontSpecRef.current = fontSpec
  }, [fontSpec])

  // 卸载时清理全部纹理
  useEffect(() => () => {
    rasterCacheRef.current.forEach(r => { r.texture.dispose(); r.glowTexture.dispose() })
    rasterCacheRef.current.clear()
  }, [])

  // ── 星尘几何 / 材质 ──
  const starfieldGeometry = useMemo(
    () => createStarfieldGeometry(tuning.starCount, hashSeed(seed)),
    [tuning.starCount, seed],
  )
  const starfieldMaterial = useMemo(
    () => createStarfieldMaterial(
      paletteTarget.starInner.clone(),
      paletteTarget.starOuter.clone(),
      tuning.spiralDriftSpeed * 2.5,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tuning.spiralDriftSpeed, starfieldGeometry],
  )
  useEffect(() => () => {
    starfieldGeometry.dispose()
    starfieldMaterial.dispose()
  }, [starfieldGeometry, starfieldMaterial])

  // ── 核心辉光纹理 ──
  const coreGlowTexture = useMemo(() => createRadialGlowTexture(), [])
  useEffect(() => () => { coreGlowTexture.dispose() }, [coreGlowTexture])

  // ── 可见行预计算 ──
  const visibleLines = useMemo<GalaxyVisibleLine[]>(() => {
    const start = Math.max(0, currentLineIndex - LINES_BEHIND)
    const end = Math.min(lines.length - 1, currentLineIndex + LINES_AHEAD)
    const result: GalaxyVisibleLine[] = []
    for (let i = start; i <= end; i++) {
      const line = lines[i]
      if (!line?.fullText) continue
      const timeline = buildLineGraphemeTimeline(line)
      const units = buildGalaxyUnits(line, timeline)
      if (units.length === 0) continue
      const placements = buildGalaxyPlacements(units, line.fullText, fontSpec)
      const lineWidth = measureLineWidth(line.fullText, fontSpec)
      const lineScale = Math.min(1, MAX_READABLE_WIDTH / Math.max(lineWidth, 0.001))
      // 逐字螺旋参数（确定性随机，避免每帧分配）
      const rng = seededRandom(hashSeed(seed) + i * 7919 + hashSeed(line.fullText))
      const spread = lineAngularSpread(lineWidth, 4)
      const spirals = units.map((_, j) => {
        const tt = units.length > 1 ? j / (units.length - 1) : 0.5
        return {
          theta: (tt - 0.5) * spread + (rng() - 0.5) * 0.22,
          radialJitter: rng() * 2 - 1,
          yJitter: rng() * 2 - 1,
          phase: rng(),
        }
      })
      result.push({ index: i, line, units, placements, spirals, lineScale, lineWidth })
    }
    return result
  }, [lines, currentLineIndex, fontSpec, seed])

  // ── 帧循环 ──
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const now = currentTime.get()

    // 色板阻尼（切歌换色平滑过渡）
    if (!dampedPaletteRef.current) {
      dampedPaletteRef.current = clonePalette(paletteTarget)
    }
    const pal = dampedPaletteRef.current
    const colorK = 1 - Math.exp(-PALETTE_DAMP_RATE * delta)
    lerpPalette(pal, paletteTarget, colorK)
    const sceneFog = state.scene.fog
    if (sceneFog instanceof THREE.Fog) sceneFog.color.copy(pal.deepSpace)

    // 音频
    const bass01 = Math.min(1, audioBands.bass.get() / 255)
    const power01 = Math.min(1, audioPower.get() / 255)
    powerEnvRef.current += (power01 - powerEnvRef.current) * (1 - Math.exp(-12 * delta))

    // 星系整体漂移（旋臂角度随时间推进，可读行不受影响）
    driftRef.current += tuning.spiralDriftSpeed * delta
    const drift = driftRef.current

    // 星尘 uniforms（内暖外冷，拉开明度差 → 纵深）
    const starU = starfieldMaterial.uniforms as StarfieldUniforms
    starU.uTime.value = t
    starU.uBass.value = bass01
    starU.uColorInner.value.copy(pal.starInner)
    starU.uColorOuter.value.copy(pal.starOuter)
    if (starfieldRef.current) {
      starfieldRef.current.rotation.y = drift * 0.4
    }

    // 核心辉光（近白暖光，峰值压低避免中心过曝成大白团）
    const core = coreGlowRef.current
    if (core) {
      const coreBreath = 1 + 0.06 * Math.sin(t * 1.7)
      core.scale.setScalar((2.2 + bass01 * 1.0) * coreBreath)
      const cm = core.material as THREE.SpriteMaterial
      cm.opacity = 0.18 + bass01 * 0.16 + powerEnvRef.current * 0.08
      cm.color.copy(pal.coreGlow)
    }

    // 星云（低明度补色，各片独立取色）
    nebulaRefs.current.forEach((sprite, i) => {
      if (!sprite) return
      const theta = (NEBULA_THETAS[i] ?? 0) + drift * 0.7
      const p = spiralPosition(theta, 0, i % 2 === 1)
      sprite.position.set(p.x, p.y * 0.6, p.z)
      sprite.scale.setScalar((NEBULA_SCALES[i] ?? 5) * (1 + bass01 * 0.18))
      const m = sprite.material as THREE.SpriteMaterial
      m.color.copy(pal.nebula[i] ?? pal.nebula[0])
      m.opacity = 0.05 + 0.04 * Math.sin(t * 0.4 + i * 2.1) + bass01 * 0.03
    })

    // 广告牌朝向：所有字符面片共享相机朝向
    const billboardQ = state.camera.quaternion
    const breath = 0.9 + 0.1 * Math.sin(t * 1.9)
    const posK = 1 - Math.exp(-POS_DAMP_RATE * delta)

    visibleLines.forEach(({ index, line, units, placements, spirals, lineScale }) => {
      const offset = index - currentLineIndex
      const isActive = offset === 0
      const lineRenderEnd = getLineRenderEndTime(line)
      // 非逐字歌词（LRC）所有字时间相同，汇聚时加人工错开
      const needsStagger = units.length > 1
        && Math.abs(units[units.length - 1].startTime - units[0].startTime) < 0.05

      units.forEach((unit, i) => {
        const key = `${index}-${i}`
        const group = unitGroupRefs.current.get(key)
        if (!group) return
        const mainMat = mainMatRefs.current.get(key)
        const glowMat = glowMatRefs.current.get(key)
        const spiral = spirals[i]
        const placement = placements[i]
        if (!spiral || !placement) return

        // 可读位置（世界坐标，稳定不旋转）
        const rx = placement.centerX * lineScale
        const ry = 0
        const rz = arcCurveZ(rx)

        let tx = rx
        let ty = ry
        let tz = rz
        let opacity = 0
        let scale = 1
        let glowOpacity = 0
        // 高亮量 [0,1]：由逐字辉光包络驱动，同时平滑控制辉光/accent 色/放大，避免瞬时跳变
        let accentAmount = 0

        const shimmer = 0.5 + 0.5 * Math.sin(t * (1.6 + spiral.phase * 1.4) + spiral.phase * 12.566)

        if (isActive) {
          const stagger = needsStagger ? i * tuning.staggerDelay : 0
          const assembleStart = unit.startTime + stagger

          if (now < assembleStart) {
            // 等待演唱：围绕可读位置旋转漂浮（星尘环绕）
            tx = rx + Math.sin(t * 0.8 + spiral.phase * 6.283) * 0.55
            ty = 0.35 + Math.cos(t * 0.62 + spiral.phase * 4.4) * 0.38
            tz = rz - 0.45 + Math.sin(t * 0.5 + spiral.phase * 9.4) * 0.35
            opacity = 0.14 + 0.1 * shimmer
            scale = 0.5
          } else {
            // 汇聚：从星尘位置弹入可读位置
            const at = clamp01((now - assembleStart) / tuning.assembleDuration)
            const e = easeOutBack(at)
            if (at < 1) {
              const ox = rx + Math.sin(spiral.phase * 6.283) * 0.9
              const oy = 0.5 + Math.cos(spiral.phase * 4.4) * 0.4
              const oz = rz - 0.8 + Math.sin(spiral.phase * 9.4) * 0.5
              tx = ox + (rx - ox) * e
              ty = oy + (ry - oy) * e
              tz = oz + (rz - oz) * e
            }
            opacity = 0.2 + 0.8 * smoothstep(Math.min(at * 1.6, 1))
            scale = 0.5 + 0.5 * e

            // 逐字辉光包络：演唱前提前淡入 → 峰值 → 结束后拖尾淡出（替代瞬时点亮/熄灭）
            accentAmount = graphemeGlowEnvelope(
              now, unit.startTime, unit.endTime, GLOW_FADE_IN, GLOW_FADE_OUT,
            )
            const sung = now >= unit.endTime
            // 已唱字保留一丝常驻微光，与包络取较大值实现峰值→余晖→残光的连续过渡
            const glowFloor = sung ? GLOW_RESIDUAL : 0
            const glowActive = breath * (0.55 + 0.45 * powerEnvRef.current)
            glowOpacity = Math.max(glowFloor, accentAmount * glowActive) * tuning.glowIntensity
            // 放大与轻微上浮随包络平滑起伏
            scale *= 1 + 0.12 * accentAmount
            ty += 0.05 * accentAmount
          }
        } else if (offset < 0) {
          // 已唱行：沿近侧旋臂向外、向上漂散
          const relPast = -offset
          const age = Math.max(0, now - lineRenderEnd)
          const dt = clamp01((age - i * tuning.staggerDelay * 0.6) / tuning.disperseDuration)
          const e = smoothstep(dt)

          const angle = pastArmAngle(relPast, spiral.theta, drift)
          const sp = spiralPosition(angle, age, false)
          const jx = sp.x + spiral.radialJitter * 0.35 * Math.cos(angle)
          const jy = sp.y + spiral.yJitter * 0.4
          const jz = sp.z + spiral.radialJitter * 0.35 * Math.sin(angle)

          tx = rx + (jx - rx) * e
          ty = ry + (jy - ry) * e
          tz = rz + (jz - rz) * e

          const baseOpacity = relPast === 1 ? 0.42 : relPast === 2 ? 0.24 : 0.12
          const ageFade = 1 / (1 + Math.max(0, age - 5) * 0.18)
          opacity = baseOpacity * ageFade * (1 - e * 0.45) * (0.7 + 0.3 * shimmer)
          scale = 1 - 0.4 * e
        } else {
          // 未来行：沿远侧旋臂在银盘下方盘旋等待
          const relFuture = offset
          const angle = futureArmAngle(relFuture, spiral.theta, drift)
          const sp = spiralPosition(angle, 0, true)
          tx = sp.x + spiral.radialJitter * 0.3 * Math.cos(angle)
          ty = sp.y + spiral.yJitter * 0.3
          tz = sp.z + spiral.radialJitter * 0.3 * Math.sin(angle)

          const baseOpacity = relFuture === 1 ? 0.2 : 0.11
          opacity = baseOpacity * (0.6 + 0.4 * shimmer)
          scale = 0.55 - relFuture * 0.08
        }

        // 阻尼追踪目标位置（同时柔化行切换时的跳变）
        // Skip position/quaternion/scale updates when the unit is effectively
        // invisible — saves 3x position lerp + quaternion copy + scale set
        // per invisible unit per frame.
        const isEffectivelyInvisible = opacity < 0.003 && glowOpacity < 0.003
        if (!isEffectivelyInvisible) {
          group.position.x += (tx - group.position.x) * posK
          group.position.y += (ty - group.position.y) * posK
          group.position.z += (tz - group.position.z) * posK
          group.quaternion.copy(billboardQ)
          group.scale.setScalar(Math.max(0.01, scale * lineScale))
        }

        if (mainMat) {
          // Only write opacity/color when the value actually changes —
          // avoids triggering three.js's material.needsUpdate path.
          if (mainMat.opacity !== opacity) mainMat.opacity = opacity
          // 基色（未唱/已唱/过去行）→ 高亮色按包络平滑插值，颜色随虚影一起渐变
          const baseColor = offset < 0 && offset !== -1 ? pal.textPast : pal.textNormal
          mainMat.color.copy(baseColor)
          if (accentAmount > 0) mainMat.color.lerp(pal.textActive, accentAmount)
        }
        if (glowMat) {
          const clampedGlow = Math.min(1, glowOpacity)
          if (glowMat.opacity !== clampedGlow) glowMat.opacity = clampedGlow
          glowMat.color.copy(pal.textGlow)
        }
      })
    })
  })

  // ── 渲染 ──
  return (
    <group>
      {/* 背景星尘 */}
      <points
        ref={starfieldRef}
        geometry={starfieldGeometry}
        material={starfieldMaterial}
        frustumCulled={false}
      />

      {/* 星系核心辉光 */}
      <sprite ref={coreGlowRef} renderOrder={-1}>
        <spriteMaterial
          map={coreGlowTexture}
          transparent
          opacity={0.26}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </sprite>

      {/* 星云光雾 */}
      {NEBULA_THETAS.map((_, i) => (
        <sprite
          key={`nebula-${i}`}
          ref={el => { nebulaRefs.current[i] = el }}
          renderOrder={-1}
        >
          <spriteMaterial
            map={coreGlowTexture}
            transparent
            opacity={0.06}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            fog={false}
          />
        </sprite>
      ))}

      {/* 歌词字符单元 */}
      {showLyrics && visibleLines.map(({ index, units, placements }) => (
        <group key={index}>
          <group scale={lyricsFontScale}>
            {units.map((unit, i) => {
              const raster = getUnitRaster(unit.text, fontSpec)
              const placement = placements[i]
              if (!placement) return null
              const refKey = `${index}-${i}`
              return (
                <group
                  key={i}
                  ref={el => { if (el) unitGroupRefs.current.set(refKey, el); else unitGroupRefs.current.delete(refKey) }}
                >
                  {/* 辉光层（加色混合，仅当前演唱字可见） */}
                  <mesh position={[0, 0, -0.02]} renderOrder={0}>
                    <planeGeometry args={[placement.width * 1.4, placement.height * 1.4]} />
                    <meshBasicMaterial
                      ref={el => { if (el) glowMatRefs.current.set(refKey, el); else glowMatRefs.current.delete(refKey) }}
                      map={raster.glowTexture}
                      transparent
                      opacity={0}
                      depthTest={false}
                      depthWrite={false}
                      blending={THREE.AdditiveBlending}
                      side={THREE.FrontSide}
                    />
                  </mesh>
                  {/* 文字主体 */}
                  <mesh renderOrder={1}>
                    <planeGeometry args={[placement.width, placement.height]} />
                    <meshBasicMaterial
                      ref={el => { if (el) mainMatRefs.current.set(refKey, el); else mainMatRefs.current.delete(refKey) }}
                      map={raster.texture}
                      transparent
                      opacity={0}
                      depthWrite={false}
                      side={THREE.FrontSide}
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

export default GalaxyScene