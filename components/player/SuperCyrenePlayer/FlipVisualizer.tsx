"use client"

import React from "react"
import { Canvas } from "@react-three/fiber"
import { AnimatePresence, motion } from "framer-motion"
import type { MotionValue } from "framer-motion"
import type { AudioBands, Line, Theme } from "./default-core/default-types"
import { DEFAULT_FLIP_TUNING } from "./flip-core/flip-types"
import type { FlipTuning } from "./flip-core/flip-types"
import FlipCameraRig from "./flip-core/FlipCameraRig"
import FlipScene from "./flip-core/FlipScene"

interface FlipVisualizerProps {
  currentTime: MotionValue<number>
  currentLineIndex: number
  lines: Line[]
  theme: Theme
  audioPower: MotionValue<number>
  audioBands: AudioBands
  showText?: boolean
  seed?: string | number
  lyricsFontScale?: number
  tuning?: FlipTuning
}

/**
 * 翻牌矩阵可视化器 -- R3F Canvas 外壳。
 *
 * 与 PixelVisualizer 对应，但去掉了序列器 / 过渡状态机 / 乐器段幻影行，
 * 因为翻牌矩阵的焦点在牌面翻转本身。
 */
const FlipVisualizer: React.FC<FlipVisualizerProps> = (props) => {
  const {
    currentTime, currentLineIndex, lines, theme,
    audioPower, audioBands, showText = true,
    lyricsFontScale = 1, tuning,
  } = props

  const flipTuning = tuning ?? DEFAULT_FLIP_TUNING

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, flipTuning.cameraDistance], fov: 55 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <FlipCameraRig
            audioBands={audioBands}
            motionAmount={flipTuning.motionAmount}
            cameraDistance={flipTuning.cameraDistance}
          />
          <FlipScene
            lines={lines}
            currentLineIndex={currentLineIndex}
            currentTime={currentTime}
            theme={theme}
            audioBands={audioBands}
            audioPower={audioPower}
            showLyrics={showText}
            tuning={flipTuning}
            lyricsFontScale={lyricsFontScale}
          />
        </Canvas>
      </div>

      <div className="relative z-10 w-full h-[70vh] flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {showText && currentLineIndex < 0 ? (
            <motion.div
              key="flip-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-2xl opacity-50 absolute"
              style={{ color: theme.secondaryColor }}
            >
              等待音乐
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default FlipVisualizer