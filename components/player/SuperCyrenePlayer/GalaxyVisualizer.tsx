"use client"

import React from "react"
import { Canvas } from "@react-three/fiber"
import { AnimatePresence, motion } from "framer-motion"
import type { MotionValue } from "framer-motion"
import type { AudioBands, Line, Theme } from "./default-core/default-types"
import { DEFAULT_GALAXY_TUNING } from "./galaxy-core/galaxy-types"
import type { GalaxyTuning } from "./galaxy-core/galaxy-types"
import GalaxyCameraRig from "./galaxy-core/GalaxyCameraRig"
import GalaxyScene from "./galaxy-core/GalaxyScene"
import { useIsMobile } from "@/hooks/use-mobile"

interface GalaxyVisualizerProps {
  currentTime: MotionValue<number>
  currentLineIndex: number
  lines: Line[]
  theme: Theme
  audioPower: MotionValue<number>
  audioBands: AudioBands
  showText?: boolean
  seed?: string | number
  lyricsFontScale?: number
  tuning?: GalaxyTuning
  /** 星系主色相（度），由封面派生 */
  hue?: number
}

/**
 * 螺旋星系可视化器 -- R3F Canvas 外壳。
 *
 * 与 FlipVisualizer / PixelVisualizer 对应，
 * 将 GalaxyScene（three.js 螺旋星系歌词）包裹在 Canvas 中。
 */
const GalaxyVisualizer: React.FC<GalaxyVisualizerProps> = (props) => {
  const {
    currentTime, currentLineIndex, lines, theme,
    audioPower, audioBands, showText = true,
    seed, lyricsFontScale = 1, tuning, hue = 258,
  } = props

  const isMobile = useIsMobile()
  const canvasDpr = isMobile ? [1, 1] as [number, number] : [1, 1.5] as [number, number]

  const galaxyTuning = tuning ?? DEFAULT_GALAXY_TUNING

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, galaxyTuning.cameraDistance * 0.42, galaxyTuning.cameraDistance * 0.9], fov: 55 }}
          dpr={canvasDpr}
          gl={{ alpha: true, antialias: !isMobile, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <GalaxyCameraRig
            audioBands={audioBands}
            motionAmount={galaxyTuning.motionAmount}
            cameraDistance={galaxyTuning.cameraDistance}
          />
          <GalaxyScene
            lines={lines}
            currentLineIndex={currentLineIndex}
            currentTime={currentTime}
            theme={theme}
            audioBands={audioBands}
            audioPower={audioPower}
            showLyrics={showText}
            tuning={galaxyTuning}
            lyricsFontScale={lyricsFontScale}
            seed={seed}
            hue={hue}
          />
        </Canvas>
      </div>

      <div className="relative z-10 w-full h-[70vh] flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {showText && currentLineIndex < 0 ? (
            <motion.div
              key="galaxy-empty"
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

export default GalaxyVisualizer