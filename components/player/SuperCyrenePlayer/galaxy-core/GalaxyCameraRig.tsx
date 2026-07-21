"use client"

import React, { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { AudioBands } from "./galaxy-types"

interface GalaxyCameraRigProps {
  audioBands: AudioBands
  motionAmount: number
  cameraDistance: number
}

/**
 * 螺旋星系相机：俯瞰银盘，带缓慢轨道漂移 + bass 推近 + 呼吸起伏。
 *
 * 相机位于银盘上方偏后，以约 25° 俯角看向核心，
 * 营造"从上方俯瞰螺旋星系"的沉浸感。
 */
const GalaxyCameraRig: React.FC<GalaxyCameraRigProps> = ({
  audioBands,
  motionAmount,
  cameraDistance,
}) => {
  const { camera } = useThree()
  const posRef = useRef(new THREE.Vector3(0, cameraDistance * 0.42, cameraDistance * 0.9))
  const lookRef = useRef(new THREE.Vector3(0, 0, 0))

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const bass = Math.min(1, audioBands.bass.get() / 255)
    const treble = Math.min(1, audioBands.treble.get() / 255)

    // 缓慢轨道漂移：相机绕 Y 轴做微小弧线运动
    const orbitAngle = Math.sin(t * 0.12) * 0.18 * motionAmount
    const orbitRadius = cameraDistance * 0.9

    // 俯角呼吸：轻微上下起伏
    const heightBreath = cameraDistance * 0.42 + Math.sin(t * 0.19 + 0.8) * 0.15 * motionAmount

    // bass 推近：低频时相机微微前倾
    const bassPush = bass * 0.35 * motionAmount

    // treble 微颤：高频时轻微抖动（增加能量感）
    const trebleShake = treble * 0.02 * motionAmount

    const targetX = Math.sin(orbitAngle) * orbitRadius + Math.sin(t * 7.3) * trebleShake
    const targetY = heightBreath - bassPush * 0.3
    const targetZ = Math.cos(orbitAngle) * orbitRadius - bassPush

    const k = 1 - Math.exp(-2.8 * delta)
    posRef.current.x += (targetX - posRef.current.x) * k
    posRef.current.y += (targetY - posRef.current.y) * k
    posRef.current.z += (targetZ - posRef.current.z) * k

    camera.position.copy(posRef.current)

    // 视线目标：微微跟随轨道偏移，看向星系核心偏上
    const lookX = Math.sin(orbitAngle) * 0.3
    const lookY = -0.15 + Math.sin(t * 0.15) * 0.08 * motionAmount
    lookRef.current.x += (lookX - lookRef.current.x) * k
    lookRef.current.y += (lookY - lookRef.current.y) * k
    camera.lookAt(lookRef.current)
  })

  return null
}

export default GalaxyCameraRig