"use client"

import React, { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { MotionValue } from "framer-motion"
import * as THREE from "three"
import type { AudioBands, DioramaGeometryMode } from "./pixel-types"
import { DIORAMA_STEP_DISTANCE, hashSeed, seededUnit } from "./pixel-cameraPath"
import type { DioramaParticleClusterAnchor } from "./pixel-geometry"
import {
  DIORAMA_PARTICLE_CORRIDOR_RADIUS,
  type DioramaParticleCorridorSpan,
} from "./pixel-particleCorridor"
import {
  buildDioramaCloudGeometryData,
  buildDioramaCorridorGeometryData,
  createDioramaBufferGeometry,
  createDioramaBandTracker,
  createDioramaParticleElasticState,
  DIORAMA_RIPPLE_COUNT,
  resolveDioramaParticleAudioResponse,
  resolveDioramaPulseTarget,
  resolveWaveNumberMax,
  RIPPLE_BANDS,
  RIPPLE_SLOTS_PER_BAND,
  stepDioramaBandTracker,
  stepDioramaEnvelope,
  stepDioramaParticleElasticResponse,
  type DioramaBandSignal,
} from "./pixel-particleModel"
import {
  createDioramaParticleGlowMaterial,
  createDioramaParticleMaterial,
  lerpDioramaParticleMaterialColors,
  resolveDioramaParticleContrastColors,
} from "./pixel-particleMaterials"

// 轻量签名：只提取影响几何体的字段，避免数组身份变化导致无谓重建
const buildClusterSignature = (clusters: DioramaParticleClusterAnchor[]): string =>
  clusters.length === 0
    ? "empty"
    : clusters.map((c) => `${c.key}:${c.kind}:${c.scale.toFixed(3)}:${c.stretchY.toFixed(3)}`).join("|")

const buildCorridorSignature = (spans: DioramaParticleCorridorSpan[]): string =>
  spans.length === 0
    ? "empty"
    : spans.map((s) => `${s.pathStart}:${s.enabled ? 1 : 0}`).join("|")

interface PixelParticleFieldProps {
  mode: DioramaGeometryMode
  clusters: DioramaParticleClusterAnchor[]
  corridorSpans: DioramaParticleCorridorSpan[]
  density: number
  particleGlowEnabled: boolean
  particleGlowIntensity: number
  currentTime: MotionValue<number>
  audioPower: MotionValue<number>
  audioBands: AudioBands
  audioLevel: number
  primaryColor: string
  accentColor: string
  secondaryColor: string
  backgroundColor: string
  transitionActive: boolean
  readHeadLine: number
  resetKey: string
}

interface RipplePool {
  sources: Float32Array
  shapes: Float32Array
  cursor: number[]
  spawned: number
}

const createRipplePool = (): RipplePool => ({
  sources: new Float32Array(DIORAMA_RIPPLE_COUNT * 4),
  shapes: new Float32Array(DIORAMA_RIPPLE_COUNT * 4),
  cursor: RIPPLE_BANDS.map(() => 0),
  spawned: 0,
})

const CORRIDOR_UNITS_PER_LINE = DIORAMA_STEP_DISTANCE / DIORAMA_PARTICLE_CORRIDOR_RADIUS

const spawnRipple = (
  pool: RipplePool,
  bandIndex: number,
  strength: number,
  now: number,
  corridor: boolean,
  readHeadAlong: number,
) => {
  const seed = hashSeed(`pixel-ripple:${pool.spawned}`)
  const preset = RIPPLE_BANDS[bandIndex]
  const height = seededUnit(seed + 1)
  const spread = seededUnit(seed + 2)
  const pace = seededUnit(seed + 3)
  const cursor = pool.cursor[bandIndex]
  const offset = (bandIndex * RIPPLE_SLOTS_PER_BAND + cursor) * 4
  if (corridor) {
    pool.sources[offset] = readHeadAlong + 0.4 + seededUnit(seed + 4) * 2.2
    pool.sources[offset + 1] = seededUnit(seed + 5) * Math.PI * 2
    pool.sources[offset + 2] = 0
  } else {
    const up = seededUnit(seed + 4) * 2 - 1
    const around = seededUnit(seed + 5) * Math.PI * 2
    const ring = Math.sqrt(Math.max(0, 1 - up * up))
    pool.sources[offset] = ring * Math.cos(around)
    pool.sources[offset + 1] = up
    pool.sources[offset + 2] = ring * Math.sin(around)
  }
  pool.sources[offset + 3] = now
  pool.shapes[offset] = preset.strength * strength * (0.7 + height * 0.6)
  pool.shapes[offset + 1] = preset.speed * (0.8 + pace * 0.45)
  pool.shapes[offset + 2] = preset.width * (0.78 + spread * 0.5)
  pool.shapes[offset + 3] = preset.wavenumber
  pool.cursor[bandIndex] = (cursor + 1) % RIPPLE_SLOTS_PER_BAND
  pool.spawned += 1
}

const FORMATION_SETTLE_SECONDS = 0.4
const CLOUD_SWELL = 0.34
const CORRIDOR_MAX_SWELL = 0.45
const CORRIDOR_QUIET_SWELL = 0.1
const MAX_WAVE = 0.85
const CLOUD_MAX_SWELL = MAX_WAVE * CLOUD_SWELL
const CORRIDOR_MAX_SWELL_REACH = MAX_WAVE * CORRIDOR_MAX_SWELL

export const PixelParticleField: React.FC<PixelParticleFieldProps> = ({
  mode, clusters, corridorSpans, density, particleGlowEnabled, particleGlowIntensity,
  currentTime, audioBands, audioLevel,
  primaryColor, accentColor, secondaryColor, backgroundColor,
  transitionActive, readHeadLine, resetKey,
}) => {
  const clusterSig = useMemo(() => buildClusterSignature(clusters), [clusters])
  const corridorSig = useMemo(() => buildCorridorSignature(corridorSpans), [corridorSpans])

  const built = useMemo(() => {
    const data = mode === "corridor"
      ? buildDioramaCorridorGeometryData(corridorSpans, density)
      : buildDioramaCloudGeometryData(clusters, density)
    return {
      geometry: createDioramaBufferGeometry(data),
      waveNumberMax: resolveWaveNumberMax(data.spacing),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, clusterSig, corridorSig, density])

  const { geometry, waveNumberMax } = built
  const targetColors = useMemo(() => resolveDioramaParticleContrastColors({
    primary: new THREE.Color(primaryColor),
    accent: new THREE.Color(accentColor),
    secondary: new THREE.Color(secondaryColor),
  }, new THREE.Color(backgroundColor)), [primaryColor, accentColor, secondaryColor, backgroundColor])

  const materialRef = useRef<ReturnType<typeof createDioramaParticleMaterial> | null>(null)
  if (materialRef.current === null) materialRef.current = createDioramaParticleMaterial(targetColors)
  const material = materialRef.current

  const glowMaterialRef = useRef<ReturnType<typeof createDioramaParticleGlowMaterial> | null>(null)
  if (glowMaterialRef.current === null) {
    glowMaterialRef.current = createDioramaParticleGlowMaterial(targetColors, particleGlowIntensity)
  }
  const glowMaterial = glowMaterialRef.current

  const trackersRef = useRef(RIPPLE_BANDS.map(() => createDioramaBandTracker()))
  const ripplesRef = useRef<RipplePool>(createRipplePool())
  const flowTimeRef = useRef(0)
  const previousPlaybackTimeRef = useRef<number | null>(null)
  const drawingBufferSizeRef = useRef(new THREE.Vector2())
  const elasticStateRef = useRef(createDioramaParticleElasticState())
  const formationRef = useRef(1)
  const lockedSecondsRef = useRef(FORMATION_SETTLE_SECONDS)

  useEffect(() => () => { geometry.dispose() }, [geometry])
  useEffect(() => () => { material.dispose(); glowMaterial.dispose() }, [glowMaterial, material])
  useEffect(() => { glowMaterial.uniforms.uGlow.value = particleGlowIntensity }, [glowMaterial, particleGlowIntensity])
  useEffect(() => {
    previousPlaybackTimeRef.current = null
    elasticStateRef.current = createDioramaParticleElasticState()
    ripplesRef.current = createRipplePool()
    trackersRef.current = RIPPLE_BANDS.map(() => createDioramaBandTracker())
  }, [resetKey])

  useFrame((frameState, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    const bassTarget = Math.min(1, audioBands.bass.get() / 255)
    const midTarget = Math.min(1, (audioBands.lowMid.get() * 0.5 + audioBands.mid.get() * 0.5) / 255)
    const trebleTarget = Math.min(1, audioBands.treble.get() / 255)
    const trackers = trackersRef.current
    const bass = stepDioramaBandTracker(trackers[0], bassTarget, delta)
    const mid = stepDioramaBandTracker(trackers[1], midTarget, delta)
    const treble = stepDioramaBandTracker(trackers[2], trebleTarget, delta)
    const bands: DioramaBandSignal[] = [bass, mid, treble]
    const response = resolveDioramaParticleAudioResponse(bass, mid)
    const gain = Math.max(0, audioLevel)

    const playbackTime = Math.max(0, currentTime.get())
    const previousPlaybackTime = previousPlaybackTimeRef.current
    const playbackDelta = previousPlaybackTime == null ? 0 : playbackTime - previousPlaybackTime
    const playbackDiscontinuity = previousPlaybackTime == null || playbackDelta < -0.05 || playbackDelta > 0.5
    if (playbackDiscontinuity) {
      flowTimeRef.current = playbackTime * 0.28
      ripplesRef.current = createRipplePool()
    } else if (playbackDelta > 0) {
      flowTimeRef.current += playbackDelta * response.flowSpeed
    }
    previousPlaybackTimeRef.current = playbackTime

    const pool = ripplesRef.current
    const isCorridor = mode === "corridor"
    const readHeadAlong = readHeadLine * CORRIDOR_UNITS_PER_LINE
    if (gain > 0.001) {
      bands.forEach((signal, index) => {
        if (!signal.onset) return
        spawnRipple(pool, index, signal.transient, flowTimeRef.current, isCorridor, readHeadAlong)
      })
    }

    const elasticPulse = stepDioramaParticleElasticResponse(
      elasticStateRef.current,
      resolveDioramaPulseTarget(response.clusterPulse, gain, isCorridor),
      delta,
    )
    frameState.gl.getDrawingBufferSize(drawingBufferSizeRef.current)
    const colorAmount = 1 - Math.exp(-1.2 * delta)

    lockedSecondsRef.current = transitionActive
      ? 0
      : Math.min(FORMATION_SETTLE_SECONDS, lockedSecondsRef.current + delta)
    const formationTarget = !transitionActive && lockedSecondsRef.current >= FORMATION_SETTLE_SECONDS ? 1 : 0
    formationRef.current = stepDioramaEnvelope(formationRef.current, formationTarget, 1.5, 3.2, delta)

    const amplitude = gain * (isCorridor
      ? Math.min(CORRIDOR_MAX_SWELL, CORRIDOR_QUIET_SWELL + bass.sustained * 0.18 + mid.sustained * 0.08)
      : CLOUD_SWELL)
    const flow = isCorridor ? 1 : 0
    const scatterDistance = isCorridor ? 6 : 1.4
    const sizeBase = isCorridor ? 0.072 : 0.05
    const sizeGain = isCorridor ? 0.34 : 0.3
    const centroid = Math.min(1, 0.2 + treble.sustained * 0.8)
    const viewportHeight = drawingBufferSizeRef.current.y

    for (const target of [material, glowMaterial]) {
      const u = target.uniforms
      u.uTime.value = flowTimeRef.current
      u.uCorridor.value = isCorridor ? 1 : 0
      u.uAmplitude.value = amplitude
      u.uMaxSwell.value = isCorridor ? CORRIDOR_MAX_SWELL_REACH : CLOUD_MAX_SWELL
      u.uWaveNumberMax.value = waveNumberMax
      u.uDetail.value = Math.min(1, treble.sustained * gain)
      u.uRippleSource.value = pool.sources
      u.uRippleShape.value = pool.shapes
      u.uOffsetGain.value = mid.sustained * gain
      u.uFlow.value = flow
      u.uFormation.value = formationRef.current
      u.uScatter.value = scatterDistance
      u.uSizeBase.value = sizeBase
      u.uSizeGain.value = sizeGain
      u.uPulse.value = elasticPulse
      u.uSpectralCentroid.value = centroid
      u.uViewportHeight.value = viewportHeight
      lerpDioramaParticleMaterialColors(target, targetColors, colorAmount)
    }
  })

  return (
    <>
      {particleGlowEnabled && (
        <points geometry={geometry} material={glowMaterial} frustumCulled={false} renderOrder={3} />
      )}
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />
    </>
  )
}

export default PixelParticleField