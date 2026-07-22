"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { MotionValue } from "framer-motion"
import * as THREE from "three"
import type { AudioBands, DioramaGeometryMode, DioramaGeometryVisibility, Line, Theme } from "./pixel-types"
import { buildLineGraphemeTimeline, splitLyricGraphemes, type GraphemeTiming } from "../default-core/graphemeTiming"
import { getLineRenderEndTime } from "../default-core/renderHints"
import { resolveThemeFontStack } from "../default-core/fontStacks"
import {
  buildFormation,
  DIORAMA_HERO_DISTANCE,
  getDioramaShot,
  getDioramaTextPlacement,
  getFrame,
  type DioramaFrame,
  type DioramaMotionParams,
  type DioramaShapePlacement,
  type DioramaTextPlacement,
} from "./pixel-cameraPath"
import { resolveGlobal, type ResolvedGlobalLine, type SequencerState, totalGlobalLines } from "./pixel-sequencer"
import {
  DIORAMA_CLUSTER_COLLISION_LINE_SPAN,
  selectVisibleDioramaClusters,
  type DioramaParticleClusterAnchor,
} from "./pixel-geometry"
import {
  buildDioramaFontSpec,
  DIORAMA_RASTER_FONT_PX,
  measureDioramaText,
  rasterDioramaLine,
  rasterDioramaUnit,
  type DioramaLineRaster,
  type DioramaUnitRaster,
} from "./pixel-textRaster"
import { PixelParticleField } from "./PixelParticleField"
import { buildDioramaParticleCorridorWindow } from "./pixel-particleCorridor"
import {
  DIORAMA_MOTE_LINES_AHEAD,
  DIORAMA_MOTE_LINES_BEHIND,
  DIORAMA_MOTE_WINDOW_LINES,
  dioramaMoteSlot,
  extendDioramaFrame,
  resolveDioramaMoteCircumference,
  resolveDioramaMoteRadial,
  writeDioramaMoteLine,
} from "./pixel-moteField"
import {
  prepareDioramaKeywordMatchers,
  resolveDioramaKeywordUnitColors,
} from "./pixel-keywordColor"
import { buildKaomojiAtlas } from "./pixel-kaomoji"
import { KAOMOJI_VERTEX_SHADER, KAOMOJI_FRAGMENT_SHADER } from "./pixel-kaomojiShaders"

// ── 生命周期常量 ──
const LINES_AHEAD = 2
const LINES_BEHIND = 1
const OUTGOING_LINES_BEHIND = 1
const OUTGOING_LINES_AHEAD = 1
const CORRIDOR_LINES_AHEAD = 4
const CORRIDOR_LINES_BEHIND = 3
const NEIGHBOR_RASTER_BUDGET = 2

const resolveNeighborLineOpacity = (offset: number): number => {
  if (offset === -1) return 0.3
  if (offset === -2) return 0.1
  if (offset === 1) return 0.34
  if (offset === 2) return 0.16
  if (offset === 3) return 0.06
  return 0
}
const resolveOutgoingLineOpacity = (offsetFromOutgoing: number): number =>
  offsetFromOutgoing === 0 ? 0.7 : Math.abs(offsetFromOutgoing) <= 2 ? 0.45 : 0.25

const LINE_FONT_SIZE = 0.62
const TARGET_FRAME_WIDTH_FRACTION = 0.72
const MIN_FIT_SCALE = 0.28
const DEG_TO_RAD = Math.PI / 180
const FOG_NEAR = 12
const FOG_FAR = 30
const TEXT_DISSOLVE_START = 2.0
const TEXT_DISSOLVE_END = 0.9
const TEXT_FADE_IN_START = 32
const TEXT_FADE_IN_END = 40
const COLOR_DAMP_RATE = 1.2
const ACTIVE_LINE_OPACITY = 0.92
const UNSUNG_UNIT_OPACITY = 0.5
const UNIT_GLOW_MAX_OPACITY = 0.9
const SOUL_MAX_OPACITY = 0.6
const SOUL_ACTIVE_LIFT_EM = 0.06
const SOUL_DETACH_LIFT_EM = 0.5
const SOUL_ACTIVE_SWELL = 0.1
const SOUL_DETACH_SWELL = 0.3
const SOUL_HANDOFF_SECONDS = 0.5
const GRADIENT_HOLD_SECONDS = 0.35
const GRADIENT_TRAIL_SECONDS = 1.8

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const stepEnvelope = (current: number, target: number, attack: number, release: number, delta: number): number =>
  current + (target - current) * (1 - Math.exp(-(target > current ? attack : release) * delta))

const smoothstep01 = (t: number): number => t * t * (3 - 2 * t)

export const resolveGradientEnergy = (
  now: number,
  unit: { startTime: number; endTime: number },
): number => {
  if (now <= unit.startTime) return 0
  if (now < unit.endTime) {
    const span = Math.max(unit.endTime - unit.startTime, 0.001)
    return smoothstep01(clamp01((now - unit.startTime) / span))
  }
  const sinceSung = now - unit.endTime
  if (sinceSung <= GRADIENT_HOLD_SECONDS) return 1
  return 1 - smoothstep01(clamp01((sinceSung - GRADIENT_HOLD_SECONDS) / GRADIENT_TRAIL_SECONDS))
}

export const resolveDioramaUnitFill = (
  out: THREE.Color, primary: THREE.Color, target: THREE.Color, progress: number,
): THREE.Color => out.copy(primary).lerp(target, clamp01(progress))

export const shouldResetDioramaUnitState = (
  previousGlobalIndex: number, globalIndex: number,
  unitStateLength: number | undefined, unitCount: number,
): boolean => previousGlobalIndex !== globalIndex || unitStateLength !== unitCount

export const resolveTextLife = (distanceToCamera: number): number => {
  const farT = clamp01((TEXT_FADE_IN_END - distanceToCamera) / (TEXT_FADE_IN_END - TEXT_FADE_IN_START))
  const nearT = clamp01((distanceToCamera - TEXT_DISSOLVE_END) / (TEXT_DISSOLVE_START - TEXT_DISSOLVE_END))
  return (farT * farT * (3 - 2 * farT)) * (nearT * nearT * (3 - 2 * nearT))
}

const resolveFrameFitScale = (
  renderedWidth: number, distance: number, verticalFovDeg: number, aspect: number,
): number => {
  if (renderedWidth <= 0 || distance <= 0) return 1
  const frameWidth = 2 * distance * Math.tan((verticalFovDeg * DEG_TO_RAD) / 2) * aspect
  const targetWidth = frameWidth * TARGET_FRAME_WIDTH_FRACTION
  return Math.min(1, Math.max(MIN_FIT_SCALE, targetWidth / renderedWidth))
}

const _sungTint = new THREE.Color()
const _gradDeep = new THREE.Color()
const _neutral = new THREE.Color()
const _basisMatrix = new THREE.Matrix4()
const _basisQuat = new THREE.Quaternion()
const _tiltQuat = new THREE.Quaternion()
const _basisRight = new THREE.Vector3()
const _basisUp = new THREE.Vector3()
const _basisFwd = new THREE.Vector3()
const _axisY = new THREE.Vector3(0, 1, 0)
const _axisZ = new THREE.Vector3(0, 0, 1)

const frameQuaternion = (frame: DioramaFrame, roll = 0, yaw = 0): [number, number, number, number] => {
  _basisRight.set(frame.right.x, frame.right.y, frame.right.z)
  _basisUp.set(frame.up.x, frame.up.y, frame.up.z)
  _basisFwd.set(-frame.forward.x, -frame.forward.y, -frame.forward.z)
  _basisMatrix.makeBasis(_basisRight, _basisUp, _basisFwd)
  _basisQuat.setFromRotationMatrix(_basisMatrix)
  if (yaw !== 0) _basisQuat.multiply(_tiltQuat.setFromAxisAngle(_axisY, yaw))
  if (roll !== 0) _basisQuat.multiply(_tiltQuat.setFromAxisAngle(_axisZ, roll))
  return [_basisQuat.x, _basisQuat.y, _basisQuat.z, _basisQuat.w]
}

interface VisibleLineEntry {
  index: number
  line: Line
  placement: DioramaTextPlacement
  position: [number, number, number]
  quaternion: [number, number, number, number]
  isOutgoing: boolean
}

interface DampedThemeColors {
  primary: THREE.Color
  accent: THREE.Color
  secondary: THREE.Color
  bg: THREE.Color
}

interface LyricUnit {
  text: string
  charStart: number
  charEnd: number
  startTime: number
  endTime: number
}

const CJK_GRAPHEME_RE = /[\u2f00-\u9fff\u3040-\u30ff\uff66-\uff9f\uF900-\uFAFF\uFF66-\uFF9F\u2022\u00B7\u25A0-\u2BFF]/

interface PlacedUnitRaster {
  raster: DioramaUnitRaster
  centerX: number
  width: number
  height: number
}

interface ActiveUnitsRaster {
  units: PlacedUnitRaster[]
  lineWidth: number
}

const ACTIVE_RASTER_CACHE_LIMIT = 8

const disposeActiveUnitsRaster = (raster: ActiveUnitsRaster): void => {
  raster.units.forEach(({ raster: unitRaster }) => {
    unitRaster.baseTexture.dispose()
    unitRaster.glowTexture.dispose()
  })
}

const buildActiveUnitsRaster = (
  line: Line,
  units: LyricUnit[],
  fontSpec: string,
): ActiveUnitsRaster => {
  const worldPerPx = LINE_FONT_SIZE / DIORAMA_RASTER_FONT_PX
  const totalPx = measureDioramaText(line.fullText, fontSpec)
  return {
    units: units.map((unit) => {
      const prefixPx = measureDioramaText(line.fullText.slice(0, unit.charStart), fontSpec)
      const raster = rasterDioramaUnit(line.fullText.slice(unit.charStart, unit.charEnd), fontSpec)
      return {
        raster,
        centerX: (-totalPx / 2 + prefixPx + raster.advancePx / 2) * worldPerPx,
        width: raster.canvasWidthPx * worldPerPx,
        height: raster.canvasHeightPx * worldPerPx,
      }
    }),
    lineWidth: totalPx * worldPerPx,
  }
}

const touchActiveRasterCache = (
  cache: Map<string, ActiveUnitsRaster>,
  key: string,
  create: () => ActiveUnitsRaster,
): ActiveUnitsRaster => {
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached
  }

  const created = create()
  cache.set(key, created)
  while (cache.size > ACTIVE_RASTER_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey == null) break
    const oldest = cache.get(oldestKey)
    cache.delete(oldestKey)
    if (oldest) disposeActiveUnitsRaster(oldest)
  }
  return created
}

const buildLyricUnits = (line: Line, timeline: GraphemeTiming[]): LyricUnit[] => {
  if (timeline.length === 0) return []
  const graphemes = splitLyricGraphemes(line.fullText)
  const charOffsets: number[] = []
  let acc = 0
  for (const g of graphemes) { charOffsets.push(acc); acc += g.length }
  const units: LyricUnit[] = []
  const pushUnit = (from: number, to: number) => {
    const text = graphemes.slice(from, to).join("")
    if (text.trim().length === 0) return
    units.push({
      text,
      charStart: charOffsets[from] ?? 0,
      charEnd: (charOffsets[to - 1] ?? 0) + (graphemes[to - 1]?.length ?? 1),
      startTime: timeline[from].startTime,
      endTime: timeline[to - 1].endTime,
    })
  }
  let i = 0
  while (i < timeline.length) {
    const g = graphemes[i] ?? ""
    if (g.trim().length === 0) { i += 1; continue }
    if (CJK_GRAPHEME_RE.test(g)) { pushUnit(i, i + 1); i += 1; continue }
    const wordIndex = timeline[i].wordIndex
    let j = i + 1
    while (
      j < timeline.length
      && timeline[j].wordIndex === wordIndex
      && (graphemes[j] ?? "").trim().length > 0
      && !CJK_GRAPHEME_RE.test(graphemes[j] ?? "")
    ) { j += 1 }
    pushUnit(i, j)
    i = j
  }
  return units
}

interface PixelSceneProps {
  theme: Theme
  sequencer: SequencerState
  globalIndex: number
  activeResolved: ResolvedGlobalLine | null
  transitionOutgoingIndex: number | null
  currentTime: MotionValue<number>
  activeLineWidthRef: React.MutableRefObject<number>
  audioPower: MotionValue<number>
  audioBands: AudioBands
  motion: DioramaMotionParams
  showLyrics: boolean
  showParticles: boolean
  backgroundParticleCircumference: number
  backgroundParticleRadial: number
  geometryVisibility: DioramaGeometryVisibility
  particleDensity: number
  particleScale: number
  particleGlowEnabled: boolean
  particleGlowIntensity: number
  lyricsFontScale: number
  glowIntensity: number
  soulIntensity: number
  soulActiveEnabled: boolean
  gradientIntensity: number
  keywordColoringEnabled: boolean
}

const PixelScene: React.FC<PixelSceneProps> = ({
  theme, sequencer, globalIndex, activeResolved, transitionOutgoingIndex, currentTime,
  activeLineWidthRef, audioPower, audioBands, motion,
  showLyrics, showParticles, backgroundParticleCircumference, backgroundParticleRadial,
  geometryVisibility, particleDensity, particleScale, particleGlowEnabled, particleGlowIntensity,
  lyricsFontScale, glowIntensity, soulIntensity, soulActiveEnabled, gradientIntensity, keywordColoringEnabled,
}) => {
  const lineMeshRefs = useRef<Map<number, THREE.Mesh>>(new Map())
  const lineMatRefs = useRef<Map<number, THREE.MeshBasicMaterial>>(new Map())
  const unitsGroupRef = useRef<THREE.Group>(null)
  const unitBaseMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const unitGlowMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const unitGlowMeshRefs = useRef<Array<THREE.Mesh | null>>([])
  const unitSoulMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([])
  const unitSoulMeshRefs = useRef<Array<THREE.Mesh | null>>([])
  const unitLightValsRef = useRef<Float32Array | null>(null)
  const unitSoulValsRef = useRef<Float32Array | null>(null)
  const prevActiveGlobalRef = useRef<number>(-1)
  const powerEnvRef = useRef<number>(0)
  const trebleEnvRef = useRef<number>(0)
  const pointsRef = useRef<THREE.Points>(null)
  const pointsMatRef = useRef<THREE.ShaderMaterial>(null)
  const effectPrevGlobalRef = useRef<number>(-1)
  // 当 globalIndex 变化时，延迟到 DOM 提交后才将动画数组置 null，
  // 避免在 useFrame 中重置旧网格导致闪烁。下一帧的 useFrame 会懒初始化新数组。
  useEffect(() => {
    if (effectPrevGlobalRef.current !== globalIndex) {
      effectPrevGlobalRef.current = globalIndex
      unitLightValsRef.current = null
      unitSoulValsRef.current = null
    }
  }, [globalIndex])

  const colors = useMemo(() => ({
    primary: theme.primaryColor,
    accent: theme.accentColor || theme.primaryColor,
    secondary: theme.secondaryColor,
  }), [theme.primaryColor, theme.accentColor, theme.secondaryColor])

  const colorTargets = useMemo<DampedThemeColors>(() => ({
    primary: new THREE.Color(colors.primary),
    accent: new THREE.Color(colors.accent),
    secondary: new THREE.Color(colors.secondary),
    bg: new THREE.Color(theme.backgroundColor),
  }), [colors, theme.backgroundColor])
  const formationCacheRef = useRef<Map<number, DioramaShapePlacement[]>>(new Map())

  const dampedColorsRef = useRef<DampedThemeColors | null>(null)

  const [fontsEpoch, setFontsEpoch] = useState(0)
  useEffect(() => {
    let mounted = true
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => { if (mounted) setFontsEpoch((e) => e + 1) })
    }
    return () => { mounted = false }
  }, [])
  const fontStack = useMemo(() => resolveThemeFontStack(theme), [theme.fontStyle, theme.fontFamily, fontsEpoch])
  const fontSpec = useMemo(() => buildDioramaFontSpec(fontStack), [fontStack])

  const activeSeg = sequencer.segments[sequencer.segments.length - 1] ?? null
  const total = totalGlobalLines(sequencer)
  const linesEpoch = activeSeg?.linesEpoch ?? 0
  const activeSegKey = activeSeg?.key ?? "x"

  const mountedIndices = useMemo(() => {
    const indices = new Set<number>()
    const addWindow = (center: number, behind: number, ahead: number) => {
      const start = Math.max(center - behind, 0)
      const end = Math.min(center + ahead, total - 1)
      for (let i = start; i <= end; i += 1) indices.add(i)
    }
    addWindow(globalIndex, LINES_BEHIND, LINES_AHEAD)
    if (transitionOutgoingIndex != null) addWindow(transitionOutgoingIndex, OUTGOING_LINES_BEHIND, OUTGOING_LINES_AHEAD)
    return Array.from(indices).sort((a, b) => a - b)
  }, [globalIndex, transitionOutgoingIndex, total])

  // 预解析所有需要的行数据，避免 visibleLines 和 particleClusters 各自重复调用 resolveGlobal
  const { resolvedMap, allNeededIndices } = useMemo(() => {
    const map = new Map<number, ResolvedGlobalLine>()
    const indices = new Set(mountedIndices)
    // 扩展到 particleClusters 需要的 cluster 索引
    for (const i of mountedIndices) {
      for (let back = 0; back <= DIORAMA_CLUSTER_COLLISION_LINE_SPAN; back += 1) {
        if (i - back >= 0) indices.add(i - back)
      }
    }
    for (const i of indices) {
      const resolved = resolveGlobal(sequencer, i)
      if (resolved) map.set(i, resolved)
    }
    return { resolvedMap: map, allNeededIndices: Array.from(indices).sort((a, b) => a - b) }
  }, [mountedIndices, sequencer, linesEpoch])

  const visibleLines = useMemo(() => {
    const result: VisibleLineEntry[] = []
    for (const i of mountedIndices) {
      const resolved = resolvedMap.get(i)
      if (!resolved || !resolved.line) continue
      const { frame } = resolved
      const placement = getDioramaTextPlacement(resolved.localIndex, resolved.segment.seed, motion.weaveScale)
      const position = {
        x: frame.position.x + frame.right.x * placement.offsetR + frame.up.x * placement.offsetU,
        y: frame.position.y + frame.right.y * placement.offsetR + frame.up.y * placement.offsetU,
        z: frame.position.z + frame.right.z * placement.offsetR + frame.up.z * placement.offsetU,
      }
      result.push({
        index: i,
        line: resolved.line,
        placement,
        position: [position.x, position.y, position.z],
        quaternion: frameQuaternion(frame, placement.roll, placement.yaw),
        isOutgoing: transitionOutgoingIndex != null
          && Math.abs(i - transitionOutgoingIndex) <= Math.abs(i - globalIndex),
      })
    }
    return result
  }, [resolvedMap, mountedIndices, transitionOutgoingIndex, globalIndex, motion.weaveScale])

  const geometryMode = geometryVisibility.mode ?? "clouds"

  const corridorSpans = useMemo(() => {
    if (!geometryVisibility.enabled || geometryMode !== "corridor") return []
    const live = buildDioramaParticleCorridorWindow(sequencer, globalIndex, CORRIDOR_LINES_BEHIND, CORRIDOR_LINES_AHEAD)
    if (transitionOutgoingIndex == null) return live
    return [
      ...buildDioramaParticleCorridorWindow(sequencer, transitionOutgoingIndex, CORRIDOR_LINES_BEHIND, CORRIDOR_LINES_AHEAD),
      ...live,
    ]
  }, [geometryVisibility.enabled, geometryMode, globalIndex, transitionOutgoingIndex, sequencer, linesEpoch])

  useEffect(() => { formationCacheRef.current.clear() }, [activeSegKey])

  const particleClusters = useMemo(() => {
    if (geometryMode !== "clouds") return []
    const fCache = formationCacheRef.current
    const result: DioramaParticleClusterAnchor[] = []
    const mounted = new Set(mountedIndices)
    for (const i of allNeededIndices) {
      const resolved = resolvedMap.get(i)
      if (!resolved) continue
      const { frame, localIndex, segment } = resolved
      let pieces = fCache.get(i)
      if (!pieces) {
        const placement = getDioramaTextPlacement(localIndex, segment.seed, motion.weaveScale)
        const shot = getDioramaShot(localIndex, segment.lines, segment.seed, motion.subMode)
        pieces = buildFormation(localIndex, segment.seed, shot, frame, placement, particleScale)
        fCache.set(i, pieces)
      }
      pieces.forEach((piece, slot) => {
        result.push({
          ...piece,
          key: `${i}-${slot}`,
          sourceLine: i,
          particleSeed: `${segment.seed ?? "seed"}:${localIndex}:${slot}:${piece.kind}`,
          role: "formation",
        })
      })
    }
    return selectVisibleDioramaClusters(result, geometryVisibility)
      .filter((cluster) => mounted.has(cluster.sourceLine))
  }, [geometryMode, resolvedMap, allNeededIndices, mountedIndices, motion.weaveScale, motion.subMode, geometryVisibility, particleScale, activeSegKey])

  const moteCircumference = resolveDioramaMoteCircumference(backgroundParticleCircumference)
  const moteRadial = resolveDioramaMoteRadial(backgroundParticleRadial)
  const moteDensity = moteCircumference * moteRadial
  const motePositions = useMemo(
    () => new Float32Array(DIORAMA_MOTE_WINDOW_LINES * moteDensity * 3),
    [moteDensity],
  )
  const moteKaomoji = useMemo(
    () => new Float32Array(DIORAMA_MOTE_WINDOW_LINES * moteDensity),
    [moteDensity],
  )
  const motePhase = useMemo(
    () => new Float32Array(DIORAMA_MOTE_WINDOW_LINES * moteDensity),
    [moteDensity],
  )
  const moteAttrRef = useRef<THREE.BufferAttribute>(null)
  const moteKaomojiAttrRef = useRef<THREE.BufferAttribute>(null)
  const motePhaseAttrRef = useRef<THREE.BufferAttribute>(null)
  const moteWrittenRef = useRef<number[]>([])
  useEffect(() => { moteWrittenRef.current = [] }, [moteCircumference, moteRadial, activeSegKey])
  const particleKey = `dust-${activeSegKey}-${moteCircumference}x${moteRadial}`

  const kaomojiAtlas = useMemo(() => {
    const atlas = buildKaomojiAtlas()
    return atlas
  }, [])

  const activeLine = activeResolved?.line ?? null
  const activeEntry = useMemo(
    () => visibleLines.find((entry) => entry.index === globalIndex) ?? null,
    [visibleLines, globalIndex],
  )
  const activeLineTimeline: GraphemeTiming[] = useMemo(
    () => (activeLine ? buildLineGraphemeTimeline(activeLine) : []),
    [activeLine],
  )

  const activeLineUnits = useMemo(
    () => activeLine ? buildLyricUnits(activeLine, activeLineTimeline) : [],
    [activeLine, activeLineTimeline],
  )

  const activeRasterCacheRef = useRef<Map<string, ActiveUnitsRaster>>(new Map())
  const activeRasterKey = activeLine ? `${fontSpec}\u0000${activeLine.id ?? activeLine.fullText}` : null
  const activeUnitsRaster = useMemo(() => {
    if (!activeLine || !activeRasterKey || activeLineUnits.length === 0) return null
    return touchActiveRasterCache(
      activeRasterCacheRef.current,
      activeRasterKey,
      () => buildActiveUnitsRaster(activeLine, activeLineUnits, fontSpec),
    )
  }, [activeLine, activeLineUnits, activeRasterKey, fontSpec])

  useEffect(() => {
    const cache = activeRasterCacheRef.current
    const idle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 0))
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout
    const upcomingIndices = [globalIndex + 1, globalIndex + 2]
    const taskId = idle(() => {
      upcomingIndices.forEach((index) => {
        const line = resolvedMap.get(index)?.line
        if (!line?.fullText) return
        const timeline = buildLineGraphemeTimeline(line)
        const units = buildLyricUnits(line, timeline)
        if (units.length === 0) return
        const key = `${fontSpec}\u0000${line.id ?? line.fullText}`
        touchActiveRasterCache(cache, key, () => buildActiveUnitsRaster(line, units, fontSpec))
      })
    })
    return () => cancelIdle(taskId)
  }, [fontSpec, globalIndex, resolvedMap])

  useEffect(() => () => {
    activeRasterCacheRef.current.forEach(disposeActiveUnitsRaster)
    activeRasterCacheRef.current.clear()
  }, [])
  const keywordMatchers = useMemo(
    () => prepareDioramaKeywordMatchers(theme.wordColors, keywordColoringEnabled),
    [theme.wordColors, keywordColoringEnabled],
  )
  const keywordUnitColors = useMemo(
    () => resolveDioramaKeywordUnitColors(
      activeLine?.fullText ?? "", activeLineUnits, keywordMatchers,
      colorTargets.primary, colorTargets.accent, colorTargets.bg,
    ),
    [activeLine, activeLineUnits, keywordMatchers, colorTargets],
  )

  // Neighbour line rasters (incremental)
  const lineRasterCacheRef = useRef<Map<number, DioramaLineRaster>>(new Map())
  const lineRasterFontRef = useRef("")
  const lineRasterEpochRef = useRef(-1)
  const [, bumpNeighborTick] = useState(0)
  useEffect(() => {
    const cache = lineRasterCacheRef.current
    if (lineRasterFontRef.current !== fontSpec || lineRasterEpochRef.current !== linesEpoch) {
      cache.forEach((raster) => raster.texture.dispose())
      cache.clear()
      lineRasterFontRef.current = fontSpec
      lineRasterEpochRef.current = linesEpoch
    }
    const wanted = new Set<number>()
    visibleLines.forEach(({ index, line }) => {
      if (line?.fullText && index !== globalIndex) wanted.add(index)
    })
    let changed = false
    cache.forEach((raster, index) => {
      if (!wanted.has(index)) { raster.texture.dispose(); cache.delete(index); changed = true }
    })
    const missing: number[] = []
    wanted.forEach((index) => { if (!cache.has(index)) missing.push(index) })
    if (missing.length === 0) {
      if (changed) bumpNeighborTick((v) => v + 1)
      return undefined
    }
    let cancelled = false
    let rafId = 0
    let qi = 0
    const buildBatch = () => {
      if (cancelled) return
      for (let n = 0; n < NEIGHBOR_RASTER_BUDGET && qi < missing.length; n += 1, qi += 1) {
        const entry = visibleLines.find((e) => e.index === missing[qi])
        if (entry?.line?.fullText && !cache.has(missing[qi])) {
          cache.set(missing[qi], rasterDioramaLine(entry.line.fullText, fontStack))
        }
      }
      bumpNeighborTick((v) => v + 1)
      if (qi < missing.length) rafId = requestAnimationFrame(buildBatch)
    }
    rafId = requestAnimationFrame(buildBatch)
    return () => { cancelled = true; if (rafId) cancelAnimationFrame(rafId) }
  }, [visibleLines, globalIndex, fontSpec, fontStack, linesEpoch])

  useEffect(() => () => {
    lineRasterCacheRef.current.forEach((raster) => raster.texture.dispose())
    lineRasterCacheRef.current.clear()
  }, [])

  if (transitionOutgoingIndex != null && !lineRasterCacheRef.current.has(transitionOutgoingIndex)) {
    const leaving = visibleLines.find((entry) => entry.index === transitionOutgoingIndex)
    if (leaving?.line?.fullText) {
      lineRasterCacheRef.current.set(transitionOutgoingIndex, rasterDioramaLine(leaving.line.fullText, fontStack))
    }
  }

  const scene = useThree((state) => state.scene)
  useEffect(() => {
    const previous = scene.fog
    scene.fog = new THREE.Fog(colorTargets.bg.getHex(), FOG_NEAR, FOG_FAR)
    return () => { scene.fog = previous }
  }, [scene, colorTargets.bg])

  useFrame((frameState, delta) => {
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
    const sceneFog = frameState.scene.fog
    if (sceneFog) sceneFog.color.copy(damped.bg)

    const audioK = motion.audioLevel
    const treble01 = Math.min(1, audioBands.treble.get() / 255) * audioK
    const power01 = Math.min(1, audioPower.get() / 255) * audioK
    const trebleEnv = stepEnvelope(trebleEnvRef.current, treble01, 14, 3.2, delta)
    trebleEnvRef.current = trebleEnv
    const powerEnv = stepEnvelope(powerEnvRef.current, power01, 18, 3.5, delta)
    powerEnvRef.current = powerEnv
    const camPos = frameState.camera.position

    if (showParticles) {
      const written = moteWrittenRef.current
      const lastLine = Math.max(0, total - 1)
      let dirty = false
      for (let line = globalIndex - DIORAMA_MOTE_LINES_BEHIND; line <= globalIndex + DIORAMA_MOTE_LINES_AHEAD; line += 1) {
        const slot = dioramaMoteSlot(line)
        if (written[slot] === line) continue
        const anchorLine = Math.min(Math.max(line, 0), lastLine)
        const resolved = resolvedMap.get(anchorLine) ?? resolveGlobal(sequencer, anchorLine)
        if (!resolved) continue
        writeDioramaMoteLine(
          motePositions,
          moteKaomoji,
          motePhase,
          extendDioramaFrame(resolved.frame, line - anchorLine),
          line, moteCircumference, moteRadial, activeSeg?.seed,
        )
        written[slot] = line
        dirty = true
      }
      if (dirty) {
        if (moteAttrRef.current) moteAttrRef.current.needsUpdate = true
        if (moteKaomojiAttrRef.current) moteKaomojiAttrRef.current.needsUpdate = true
        if (motePhaseAttrRef.current) motePhaseAttrRef.current.needsUpdate = true
      }
    }

    if (pointsRef.current) {
      const t = frameState.clock.elapsedTime
      pointsRef.current.position.set(Math.sin(t * 0.17) * 0.12, Math.sin(t * 0.11 + 1.7) * 0.09, Math.cos(t * 0.13) * 0.12)
    }
    if (pointsMatRef.current) {
      const u = pointsMatRef.current.uniforms
      u.uTime.value = frameState.clock.elapsedTime
      u.uSize.value = 0.03 * (1 + 0.42 * trebleEnv)
      u.uOpacity.value = 0.16 + 0.18 * powerEnv
      u.uPulse.value = 1 + 0.1 * powerEnv
    }

    const { camera } = frameState
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 55
    visibleLines.forEach(({ index, placement, isOutgoing }) => {
      if (index === globalIndex) return
      const mesh = lineMeshRefs.current.get(index)
      const mat = lineMatRefs.current.get(index)
      const raster = lineRasterCacheRef.current.get(index)
      if (!mesh || !mat || !raster) return
      const worldWidth = raster.advancePx * (LINE_FONT_SIZE / raster.fontPx)
      const fit = resolveFrameFitScale(worldWidth, DIORAMA_HERO_DISTANCE, fov, aspect) * placement.scale * lyricsFontScale
      // Only update mesh.scale when fit actually changes — avoids marking
      // the mesh as needing a matrix update for static neighbor lines.
      if (mesh.scale.x !== fit) mesh.scale.setScalar(fit)
      const life = resolveTextLife(mesh.position.distanceTo(camPos))
      // Skip material color/opacity writes when the line is fully invisible
      // — life === 0 means the text is dissolved, so no visual change.
      if (life <= 0 && mat.opacity <= 0) return
      if (isOutgoing) {
        const targetOpacity = resolveOutgoingLineOpacity(index - (transitionOutgoingIndex ?? index)) * life
        if (mat.opacity !== targetOpacity) mat.opacity = targetOpacity
        mat.color.copy(damped.primary)
      } else {
        const offset = index - globalIndex
        const targetOpacity = resolveNeighborLineOpacity(offset) * life
        if (mat.opacity !== targetOpacity) mat.opacity = targetOpacity
        const targetColor = offset < 0 ? damped.primary : damped.secondary
        mat.color.copy(targetColor)
      }
    })

    const unitsGroup = unitsGroupRef.current
    // 单位数变化时同步重置（行内单位数不会变，仅防御性处理）
    if (prevActiveGlobalRef.current === globalIndex && unitLightValsRef.current && unitLightValsRef.current.length !== activeLineUnits.length) {
      unitLightValsRef.current = new Float32Array(activeLineUnits.length)
      unitSoulValsRef.current = new Float32Array(activeLineUnits.length)
      unitBaseMatRefs.current.length = activeLineUnits.length
      unitGlowMatRefs.current.length = activeLineUnits.length
      unitGlowMeshRefs.current.length = activeLineUnits.length
      unitSoulMatRefs.current.length = activeLineUnits.length
      unitSoulMeshRefs.current.length = activeLineUnits.length
    }
    prevActiveGlobalRef.current = globalIndex
    // 懒初始化：当 effect 将数组置 null 后，在新网格挂载后才创建动画数组
    if (!unitLightValsRef.current && activeLineUnits.length > 0 && unitBaseMatRefs.current[0]) {
      const now0 = currentTime.get()
      unitLightValsRef.current = Float32Array.from({ length: activeLineUnits.length }, (_, i) =>
        now0 >= activeLineUnits[i].endTime ? 1 : 0)
      unitSoulValsRef.current = new Float32Array(activeLineUnits.length)
    }
    if (unitsGroup && activeUnitsRaster && activeEntry && activeLine) {
      const fit = resolveFrameFitScale(activeUnitsRaster.lineWidth, DIORAMA_HERO_DISTANCE, fov, aspect)
        * activeEntry.placement.scale * lyricsFontScale
      unitsGroup.scale.setScalar(fit)
      activeLineWidthRef.current = activeUnitsRaster.lineWidth * fit
      const life = resolveTextLife(unitsGroup.position.distanceTo(camPos))
      const now = currentTime.get()
      const breath = 0.9 + 0.1 * Math.sin(frameState.clock.elapsedTime * 1.9)
      const lightVals = unitLightValsRef.current
      const soulVals = unitSoulValsRef.current

      const gradientStrength = Math.min(1.5, gradientIntensity)
      const tintSeparation = Math.abs(damped.accent.r - damped.primary.r)
        + Math.abs(damped.accent.g - damped.primary.g)
        + Math.abs(damped.accent.b - damped.primary.b)
      _sungTint.copy(damped.accent)
      if (tintSeparation < 0.4) {
        const deficit = 1 - tintSeparation / 0.4
        const primaryLum = (damped.primary.r + damped.primary.g + damped.primary.b) / 3
        const accentLum = (damped.accent.r + damped.accent.g + damped.accent.b) / 3
        const targetLum = primaryLum > 0.5 ? accentLum * (1 - 0.5 * deficit) : accentLum + (1 - accentLum) * 0.55 * deficit
        _neutral.setRGB(targetLum, targetLum, targetLum)
        _sungTint.lerp(_neutral, deficit)
      }
      const gradHot01 = Math.min(1, Math.max(0, (gradientStrength - 0.1) / 1.4))
      _gradDeep.copy(_sungTint).multiplyScalar(0.8 - 0.18 * gradHot01)

      activeLineUnits.forEach((unit, i) => {
        const baseMat = unitBaseMatRefs.current[i]
        if (!baseMat || !lightVals || !soulVals) return
        const isCurrent = now >= unit.startTime && now < unit.endTime
        const sung = now >= unit.endTime
        const span = Math.max(unit.endTime - unit.startTime, 0.001)
        const sungMix = sung ? 1 : isCurrent ? clamp01((now - unit.startTime) / span) : 0

        lightVals[i] = stepEnvelope(lightVals[i], isCurrent ? 1 : 0, 14, 4.5, delta)
        const gradientEnergy = resolveGradientEnergy(now, unit) * gradientStrength

        baseMat.opacity = Math.min(
          1,
          (UNSUNG_UNIT_OPACITY + (ACTIVE_LINE_OPACITY - UNSUNG_UNIT_OPACITY) * sungMix + 0.08 * Math.min(1, gradientEnergy)) * life,
        )

        const unitTarget = keywordUnitColors.get(i) ?? (gradientIntensity > 0 ? _gradDeep : _sungTint)
        const unitProgress = gradientIntensity > 0 ? gradientEnergy : lightVals[i] * 1.15
        resolveDioramaUnitFill(baseMat.color, damped.primary, unitTarget, unitProgress)

        const glowStrength = Math.min(1.5, glowIntensity)
        const glowLevel = lightVals[i] * life * breath * (0.6 + 0.4 * powerEnv) * glowStrength
        const glowMat = unitGlowMatRefs.current[i]
        const glowMesh = unitGlowMeshRefs.current[i]
        // Skip glow material writes when glowLevel is effectively zero —
        // avoids 2x Material.opacity + Material.color.copy per idle unit.
        if (glowLevel > 0.012) {
          if (glowMat) {
            glowMat.opacity = Math.min(1, UNIT_GLOW_MAX_OPACITY * glowLevel)
            glowMat.color.copy(baseMat.color)
          }
          if (glowMesh) glowMesh.visible = true
        } else {
          if (glowMesh && glowMesh.visible) glowMesh.visible = false
        }

        soulVals[i] = stepEnvelope(soulVals[i], isCurrent ? 1 : 0, 12, 2.2, delta)
        const soulMat = unitSoulMatRefs.current[i]
        const soulMesh = unitSoulMeshRefs.current[i]
        if (soulMat && soulMesh) {
          const soulStrength = Math.min(1.5, soulIntensity)
          const flightMix = sung ? smoothstep01(clamp01((now - unit.endTime) / SOUL_HANDOFF_SECONDS)) : 0
          const activeReach = soulActiveEnabled ? soulStrength : 0
          const onGlyph = (1 - flightMix) * activeReach
          const flown = flightMix * soulStrength
          soulMat.color.copy(baseMat.color)
          soulMat.opacity = Math.min(1, SOUL_MAX_OPACITY * life * soulVals[i] * (onGlyph + flown))
          soulMesh.position.y = LINE_FONT_SIZE * (SOUL_ACTIVE_LIFT_EM * onGlyph + SOUL_DETACH_LIFT_EM * flown)
          const soulSwell = 1 + SOUL_ACTIVE_SWELL * onGlyph + SOUL_DETACH_SWELL * flown
          soulMesh.scale.set(soulSwell, soulSwell, 1)
          soulMesh.visible = soulMat.opacity > 0.015
        }
      })
    } else {
      activeLineWidthRef.current = 0
    }
  })

  return (
    <group>
      {showParticles && (
        <points key={particleKey} ref={pointsRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute ref={moteAttrRef} attach="attributes-position" args={[motePositions, 3]} />
            <bufferAttribute ref={moteKaomojiAttrRef} attach="attributes-aKaomojiIndex" args={[moteKaomoji, 1]} />
            <bufferAttribute ref={motePhaseAttrRef} attach="attributes-aPhase" args={[motePhase, 1]} />
          </bufferGeometry>
          <shaderMaterial
            ref={pointsMatRef}
            vertexShader={KAOMOJI_VERTEX_SHADER}
            fragmentShader={KAOMOJI_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
            uniforms={{
              uAtlas: { value: kaomojiAtlas.texture },
              uCols: { value: kaomojiAtlas.cols },
              uRows: { value: kaomojiAtlas.rows },
              uTime: { value: 0 },
              uSize: { value: 0.03 },
              uOpacity: { value: 0.2 },
              uPulse: { value: 1 },
            }}
          />
        </points>
      )}

      {(geometryMode === "corridor" ? corridorSpans.length > 0 : particleClusters.length > 0) && (
        <PixelParticleField
          mode={geometryMode}
          clusters={particleClusters}
          corridorSpans={corridorSpans}
          density={particleDensity}
          particleGlowEnabled={particleGlowEnabled}
          particleGlowIntensity={particleGlowIntensity}
          currentTime={currentTime}
          audioPower={audioPower}
          audioBands={audioBands}
          audioLevel={motion.audioLevel}
          primaryColor={colors.primary}
          accentColor={colors.accent}
          secondaryColor={colors.secondary}
          backgroundColor={theme.backgroundColor}
          transitionActive={transitionOutgoingIndex != null}
          readHeadLine={globalIndex}
          resetKey={activeSegKey}
        />
      )}

      {showLyrics && visibleLines.map(({ index, line, position, quaternion, isOutgoing }) => {
        if (!line?.fullText) return null
        if (index === globalIndex) return null
        const offset = index - globalIndex
        const initialOpacity = isOutgoing
          ? resolveOutgoingLineOpacity(index - (transitionOutgoingIndex ?? index))
          : resolveNeighborLineOpacity(offset)
        if (initialOpacity <= 0) return null
        const raster = lineRasterCacheRef.current.get(index)
        if (!raster) return null
        const worldPerPx = LINE_FONT_SIZE / raster.fontPx
        const initialColor = isOutgoing || offset < 0 ? colors.primary : colors.secondary
        return (
          <mesh
            key={index}
            ref={el => { if (el) lineMeshRefs.current.set(index, el); else lineMeshRefs.current.delete(index) }}
            position={position}
            quaternion={quaternion}
            renderOrder={0}
          >
            <planeGeometry args={[raster.canvasWidthPx * worldPerPx, raster.canvasHeightPx * worldPerPx]} />
            <meshBasicMaterial
              ref={el => { if (el) lineMatRefs.current.set(index, el); else lineMatRefs.current.delete(index) }}
              map={raster.texture}
              transparent
              opacity={initialOpacity}
              depthWrite={false}
              color={initialColor}
            />
          </mesh>
        )
      })}

      {showLyrics && activeLine?.fullText && activeEntry && activeUnitsRaster && (
        <group key={globalIndex} ref={unitsGroupRef} position={activeEntry.position} quaternion={activeEntry.quaternion}>
          {activeUnitsRaster.units.map((placed, unitIndex) => (
            <React.Fragment key={unitIndex}>
              <mesh
                ref={el => { unitGlowMeshRefs.current[unitIndex] = el }}
                visible={false}
                position={[placed.centerX, 0, -0.01]}
                renderOrder={17}
              >
                <planeGeometry args={[placed.width, placed.height]} />
                <meshBasicMaterial
                  ref={el => { unitGlowMatRefs.current[unitIndex] = el }}
                  map={placed.raster.glowTexture}
                  transparent
                  opacity={0}
                  depthTest={false}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  color={colors.accent}
                />
              </mesh>
              <mesh
                ref={el => { unitSoulMeshRefs.current[unitIndex] = el }}
                visible={false}
                position={[placed.centerX, 0, -0.005]}
                renderOrder={18}
              >
                <planeGeometry args={[placed.width, placed.height]} />
                <meshBasicMaterial
                  ref={el => { unitSoulMatRefs.current[unitIndex] = el }}
                  map={placed.raster.baseTexture}
                  transparent
                  opacity={0}
                  depthTest={false}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  color={colors.accent}
                />
              </mesh>
              <mesh position={[placed.centerX, 0, 0]} renderOrder={19}>
                <planeGeometry args={[placed.width, placed.height]} />
                <meshBasicMaterial
                  ref={el => { unitBaseMatRefs.current[unitIndex] = el }}
                  map={placed.raster.baseTexture}
                  transparent
                  opacity={UNSUNG_UNIT_OPACITY}
                  depthTest={false}
                  depthWrite={false}
                  color={colors.primary}
                />
              </mesh>
            </React.Fragment>
          ))}
        </group>
      )}
    </group>
  )
}

export default PixelScene