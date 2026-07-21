"use client"

import React, { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { AudioBands } from "./flip-types"

interface FlipCameraRigProps {
  audioBands: AudioBands
  motionAmount: number
  cameraDistance: number
}

/**
 * 翻牌矩阵相机：固定朝向原点，带轻微 sway / bob / bass 推近。
 *
 * 比 PixelCameraRig 简单得多——不需要飞行路径、序列器、过渡弧线，
 * 因为翻牌矩阵的视觉焦点在牌面翻转本身，不需要相机运动来引导视线。
 */
const FlipCameraRig: React.FC<FlipCameraRigProps> = ({
  audioBands,
  motionAmount,
  cameraDistance,
}) => {
  const { camera } = useThree()
  const posRef = useRef(new THREE.Vector3(0, 0, cameraDistance))

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const bass = Math.min(1, audioBands.bass.get() / 255)

    const sway = Math.sin(t * 0.3) * 0.12 * motionAmount
    const bob = Math.sin(t * 0.21 + 1.2) * 0.06 * motionAmount
    const bassPush = bass * 0.15 * motionAmount

    const targetX = sway
    const targetY = bob
    const targetZ = cameraDistance + bassPush

    const k = 1 - Math.exp(-3 * delta)
    posRef.current.x += (targetX - posRef.current.x) * k
    posRef.current.y += (targetY - posRef.current.y) * k
    posRef.current.z += (targetZ - posRef.current.z) * k

    camera.position.copy(posRef.current)
    camera.lookAt(sway * 0.3, 0, 0)
  })

  return null
}

export default FlipCameraRig