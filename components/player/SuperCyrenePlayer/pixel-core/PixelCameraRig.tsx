"use client"

import React, { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { MotionValue } from "framer-motion"
import * as THREE from "three"
import type { Line } from "./pixel-types"
import { buildLineGraphemeTimeline, type GraphemeTiming } from "../default-core/graphemeTiming"
import { getLineRenderEndTime } from "../default-core/renderHints"
import {
  DIORAMA_CAMERA_LIFT,
  DIORAMA_HERO_DISTANCE,
  DIORAMA_SAFE_FRAME_FRACTION,
  DIORAMA_SNAP_DISTANCE,
  type DioramaMotionParams,
  type DioramaShotKind,
  frameHalfWidth,
  getDioramaShot,
  getDioramaTextPlacement,
  getFrame,
  resolveCameraDrift,
  resolveReadHeadTruck,
  resolveShotOffset,
  smoothDamp,
} from "./pixel-cameraPath"
import { type ResolvedGlobalLine } from "./pixel-sequencer"
import {
  flightPerp,
  flightSide,
  TRANSITION_AIM_SWEEP,
  TRANSITION_BANK,
  TRANSITION_DURATION,
  transitionEase,
} from "./pixel-transition"

interface PixelCameraRigProps {
  currentTime: MotionValue<number>
  globalIndex: number
  activeResolved: ResolvedGlobalLine | null
  activeLineWidthRef: React.MutableRefObject<number>
  motion: DioramaMotionParams
  transitionEpoch: number
}

const UP = new THREE.Vector3(0, 1, 0)
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const ALIGN_SHOT_CEILING: Record<DioramaShotKind, number> = {
  hold: 0.9, pushIn: 0.85, track: 0.85, swell: 0.8, float: 0.78,
  glide: 0.72, crane: 0.7, pullBack: 0.7, arc: 0.62, pendulum: 0.6,
  orbit: 0.55, spiral: 0.5, flyby: 0.5,
}
const ALIGN_LEAD_IN = 0.6
const ALIGN_SETTLE = 0.35
const ALIGN_RELEASE = 1.0
const ALIGN_RATE = 1.2
const ALIGN_TURN_RATE = 2.6
const FRAME_KEEP_FRACTION = 0.7

const smoothstep01 = (t: number): number => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

const _alignRight = new THREE.Vector3()
const _alignUp = new THREE.Vector3()
const _alignFwd = new THREE.Vector3()
const _alignMatrix = new THREE.Matrix4()
const _alignQuat = new THREE.Quaternion()
const _tiltQuat = new THREE.Quaternion()
const _lookQuat = new THREE.Quaternion()
const _AXIS_Y = new THREE.Vector3(0, 1, 0)
const _AXIS_Z = new THREE.Vector3(0, 0, 1)
const _viewDir = new THREE.Vector3()
const _camForward = new THREE.Vector3()
const _targetQuat = new THREE.Quaternion()
const _flightTo = new THREE.Vector3()
const FLIGHT_SMOOTH_TIME = 1.1
const FLIGHT_ARC_FRAC = 0.16
const ORIENT_FOLLOW_RATE = 4.2

const resolveWordProgress = (line: Line, timeline: GraphemeTiming[], now: number): number => {
  if (timeline.length === 0) return 0
  const renderEndTime = getLineRenderEndTime(line)
  if (now >= renderEndTime) return 1
  if (now <= line.startTime) return 0
  let revealed = 0
  for (let i = 0; i < timeline.length; i += 1) {
    const timing = timeline[i]
    if (now >= timing.endTime) {
      revealed = i + 1
    } else if (now >= timing.startTime) {
      const span = Math.max(timing.endTime - timing.startTime, 0.001)
      revealed = i + clamp01((now - timing.startTime) / span)
      break
    } else {
      break
    }
  }
  return revealed / timeline.length
}

const PixelCameraRig: React.FC<PixelCameraRigProps> = ({
  currentTime, globalIndex, activeResolved, activeLineWidthRef, motion, transitionEpoch,
}) => {
  const flightRef = useRef({
    flying: false, epoch: 0, start: 0,
    perp: new THREE.Vector3(), side: 1, flightLen: 1,
  })
  const posRef = useRef(new THREE.Vector3(0, 0.6, 9))
  const posVelRef = useRef(new THREE.Vector3(0, 0, 0))
  const lookRef = useRef(new THREE.Vector3(0, 0, -10))
  const lookVelRef = useRef(new THREE.Vector3(0, 0, 0))
  const alignRef = useRef(0)
  const alignQuatRef = useRef(new THREE.Quaternion())
  const alignQuatInitRef = useRef(false)
  const orientRef = useRef(new THREE.Quaternion())
  const orientInitRef = useRef(false)

  const resolved = activeResolved
  const line = resolved?.line ?? null
  const timeline = useMemo(() => (line ? buildLineGraphemeTimeline(line) : []), [line])
  const shotKind: DioramaShotKind = useMemo(
    () => (resolved ? getDioramaShot(resolved.localIndex, resolved.segment.lines, resolved.segment.seed, motion.subMode) : "hold"),
    [resolved, motion.subMode],
  )
  const placement = useMemo(
    () => getDioramaTextPlacement(resolved?.localIndex ?? 0, resolved?.segment.seed, motion.weaveScale),
    [resolved, motion.weaveScale],
  )

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30)
    if (!resolved) return
    const now = currentTime.get()
    const wordProgress = line ? resolveWordProgress(line, timeline, now) : 0
    let progress = line ? 1 : 0
    if (line) {
      const renderEndTime = getLineRenderEndTime(line)
      const span = renderEndTime - line.startTime
      progress = span > 0 ? clamp01((now - line.startTime) / span) : now >= line.startTime ? 1 : 0
    }

    const camera = state.camera as THREE.PerspectiveCamera
    const aspect = camera.isPerspectiveCamera ? camera.aspect : 1
    const fov = camera.isPerspectiveCamera ? camera.fov : 55
    const visibleHalf = frameHalfWidth(DIORAMA_HERO_DISTANCE, fov, aspect) * DIORAMA_SAFE_FRAME_FRACTION

    const frame = resolved ? resolved.frame : getFrame([], 0)
    const R = frame.right
    const U = frame.up
    const F = frame.forward

    const truck = resolveReadHeadTruck(wordProgress, activeLineWidthRef.current, visibleHalf)
    const headR = placement.offsetR + truck
    const headU = placement.offsetU
    const baseX = frame.position.x + R.x * headR + U.x * headU
    const baseY = frame.position.y + R.y * headR + U.y * headU
    const baseZ = frame.position.z + R.z * headR + U.z * headU

    const shotSeed = resolved?.segment.seed
    const shot = resolveShotOffset(shotKind, {
      progress, wordProgress,
      hero: DIORAMA_HERO_DISTANCE, lift: DIORAMA_CAMERA_LIFT,
      seed: shotSeed, lineIndex: resolved?.localIndex ?? 0,
      moveScale: motion.moveScale,
    })
    const drift = resolveCameraDrift(now, shotSeed, motion.driftScale)
    const offRight = shot.right + drift.swayX
    const offUp = shot.up + drift.swayY + drift.lift
    const offBack = shot.back + drift.dist
    const poseX = baseX + R.x * offRight + U.x * offUp - F.x * offBack
    const poseY = baseY + R.y * offRight + U.y * offUp - F.y * offBack
    const poseZ = baseZ + R.z * offRight + U.z * offUp - F.z * offBack

    const flight = flightRef.current
    if (transitionEpoch !== flight.epoch && transitionEpoch > 0) {
      flight.epoch = transitionEpoch
      flight.flying = true
      flight.start = state.clock.elapsedTime
      _flightTo.set(poseX, poseY, poseZ)
      const perp = flightPerp(posRef.current, _flightTo)
      flight.perp.set(perp.x, perp.y, perp.z)
      flight.side = flightSide(shotSeed, transitionEpoch)
      flight.flightLen = posRef.current.distanceTo(_flightTo)
    }
    let flying = false
    let te = 1
    if (flight.flying) {
      te = (state.clock.elapsedTime - flight.start) / TRANSITION_DURATION
      if (te >= 1) flight.flying = false
      else flying = true
    }
    const followSmooth = flying
      ? FLIGHT_SMOOTH_TIME + (motion.smoothTime - FLIGHT_SMOOTH_TIME) * transitionEase(te)
      : motion.smoothTime
    const swayEnv = flying ? Math.sin(Math.PI * te) ** 2 : 0
    const arcMag = swayEnv * flight.flightLen * FLIGHT_ARC_FRAC
    const sweepMag = swayEnv * flight.flightLen * TRANSITION_AIM_SWEEP * flight.side
    const bank = swayEnv * TRANSITION_BANK * flight.side

    const posGap = Math.hypot(poseX - posRef.current.x, poseY - posRef.current.y, poseZ - posRef.current.z)
    const snapped = !flying && posGap > DIORAMA_SNAP_DISTANCE
    if (snapped) {
      posRef.current.set(poseX, poseY, poseZ)
      posVelRef.current.set(0, 0, 0)
    } else {
      const sx = smoothDamp(posRef.current.x, poseX, posVelRef.current.x, followSmooth, delta)
      const sy = smoothDamp(posRef.current.y, poseY, posVelRef.current.y, followSmooth, delta)
      const sz = smoothDamp(posRef.current.z, poseZ, posVelRef.current.z, followSmooth, delta)
      posRef.current.set(sx.value, sy.value, sz.value)
      posVelRef.current.set(sx.velocity, sy.velocity, sz.velocity)
    }
    camera.position.set(
      posRef.current.x + flight.perp.x * arcMag,
      posRef.current.y + flight.perp.y * arcMag + arcMag * 0.5,
      posRef.current.z + flight.perp.z * arcMag,
    )

    const lookX = baseX + R.x * placement.lookR + flight.perp.x * sweepMag
    const lookY = baseY + R.y * placement.lookR + flight.perp.y * sweepMag
    const lookZ = baseZ + R.z * placement.lookR + flight.perp.z * sweepMag
    const lookGap = Math.hypot(lookX - lookRef.current.x, lookY - lookRef.current.y, lookZ - lookRef.current.z)
    if (!flying && lookGap > DIORAMA_SNAP_DISTANCE) {
      lookRef.current.set(lookX, lookY, lookZ)
      lookVelRef.current.set(0, 0, 0)
    } else {
      const lx = smoothDamp(lookRef.current.x, lookX, lookVelRef.current.x, followSmooth, delta)
      const ly = smoothDamp(lookRef.current.y, lookY, lookVelRef.current.y, followSmooth, delta)
      const lz = smoothDamp(lookRef.current.z, lookZ, lookVelRef.current.z, followSmooth, delta)
      lookRef.current.set(lx.value, ly.value, lz.value)
      lookVelRef.current.set(lx.velocity, ly.velocity, lz.velocity)
    }

    camera.up.copy(UP)
    camera.lookAt(lookRef.current)

    _alignRight.set(R.x, R.y, R.z)
    _alignUp.set(U.x, U.y, U.z)
    _alignFwd.set(-F.x, -F.y, -F.z)
    _alignMatrix.makeBasis(_alignRight, _alignUp, _alignFwd)
    _alignQuat.setFromRotationMatrix(_alignMatrix)
    if (placement.yaw !== 0) _alignQuat.multiply(_tiltQuat.setFromAxisAngle(_AXIS_Y, placement.yaw))
    if (placement.roll !== 0) _alignQuat.multiply(_tiltQuat.setFromAxisAngle(_AXIS_Z, placement.roll))
    if (snapped || !alignQuatInitRef.current) {
      alignQuatRef.current.copy(_alignQuat)
      alignQuatInitRef.current = true
    } else {
      alignQuatRef.current.slerp(_alignQuat, 1 - Math.exp(-ALIGN_TURN_RATE * delta))
    }

    let readTarget = 0
    if (line) {
      const renderEnd = getLineRenderEndTime(line)
      const rampIn = smoothstep01((now - (line.startTime - ALIGN_LEAD_IN)) / (ALIGN_LEAD_IN + ALIGN_SETTLE))
      const rampOut = 1 - smoothstep01((now - renderEnd) / ALIGN_RELEASE)
      readTarget = Math.min(rampIn, rampOut) * (ALIGN_SHOT_CEILING[shotKind] ?? 0.7)
    }
    alignRef.current += (readTarget - alignRef.current) * (1 - Math.exp(-ALIGN_RATE * delta))

    _lookQuat.copy(camera.quaternion)
    _targetQuat.copy(_lookQuat).slerp(alignQuatRef.current, alignRef.current)

    _viewDir.subVectors(lookRef.current, camera.position).normalize()
    _camForward.set(0, 0, -1).applyQuaternion(_targetQuat)
    const offAxisAngle = _camForward.angleTo(_viewDir)
    const halfV = THREE.MathUtils.degToRad(fov) / 2
    const halfH = Math.atan(Math.tan(halfV) * aspect)
    const maxOffAxis = Math.min(halfV, halfH) * FRAME_KEEP_FRACTION
    if (offAxisAngle > maxOffAxis) {
      _targetQuat.slerp(_lookQuat, 1 - maxOffAxis / offAxisAngle)
    }

    if (snapped || !orientInitRef.current) {
      orientRef.current.copy(_targetQuat)
      orientInitRef.current = true
    } else {
      orientRef.current.slerp(_targetQuat, 1 - Math.exp(-ORIENT_FOLLOW_RATE * delta))
    }
    camera.quaternion.copy(orientRef.current)
    if (bank !== 0) camera.rotateZ(bank)
  })

  return null
}

export default PixelCameraRig