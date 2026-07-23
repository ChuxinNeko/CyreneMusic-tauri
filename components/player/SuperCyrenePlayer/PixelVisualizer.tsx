"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { AnimatePresence, motion } from "framer-motion"
import { DEFAULT_DIORAMA_TUNING, type Line, type Theme, type AudioBands } from "./pixel-core/pixel-types"
import type { MotionValue } from "framer-motion"
import type { DioramaTuning } from "./pixel-core/pixel-types"
import {
  resolveDioramaMotionParams,
  getFrame,
  type DioramaVec,
} from "./pixel-core/pixel-cameraPath"
import {
  activeSegment,
  appendSegment,
  createSequencerState,
  pruneSegments,
  resolveGlobal,
  updateActiveSegmentLines,
} from "./pixel-core/pixel-sequencer"
import { pickTransitionOffset, TRANSITION_DURATION } from "./pixel-core/pixel-transition"
import PixelCameraRig from "./pixel-core/PixelCameraRig"
import PixelScene from "./pixel-core/PixelScene"
import { useIsMobile } from "@/hooks/use-mobile"

interface PixelVisualizerProps {
  currentTime: MotionValue<number>
  currentLineIndex: number
  lines: Line[]
  theme: Theme
  audioPower: MotionValue<number>
  audioBands: AudioBands
  showText?: boolean
  seed?: string | number
  lyricsFontScale?: number
  dioramaTuning?: DioramaTuning
}

const INSTRUMENTAL_FRAMES = 96
const INSTRUMENTAL_SECONDS_PER_FRAME = 5
const buildInstrumentalPhantomLines = (): Line[] => {
  const result: Line[] = []
  for (let i = 0; i < INSTRUMENTAL_FRAMES; i += 1) {
    const block = Math.floor(i / 4)
    const isChorus = block % 3 === 2
    result.push({
      words: [],
      startTime: i * INSTRUMENTAL_SECONDS_PER_FRAME,
      endTime: (i + 1) * INSTRUMENTAL_SECONDS_PER_FRAME,
      fullText: "",
      blockIndex: block,
      songPart: isChorus ? "chorus" : "verse",
      isChorus,
    })
  }
  return result
}

const INSTRUMENTAL_COMMIT_SECONDS = 2
const READY_GRACE_MS = 8000
const PRUNE_MARGIN_BEHIND = 4
const LOOP_RESTART_MAX_INDEX = 1

interface DioramaTransitionState {
  epoch: number
  outgoingIndex: number
}

const PixelVisualizer: React.FC<PixelVisualizerProps> = (props) => {
  const {
    currentTime, currentLineIndex, lines, theme,
    audioPower, audioBands, showText = true,
    seed, lyricsFontScale = 1, dioramaTuning,
  } = props

  const isMobile = useIsMobile()
  const canvasDpr = isMobile ? [1, 1] as [number, number] : [1, 1.5] as [number, number]

  const activeLineWidthRef = useRef(0)

  const motionParams = useMemo(
    () => resolveDioramaMotionParams(dioramaTuning, theme.animationIntensity),
    [dioramaTuning, theme.animationIntensity],
  )

  // ── "Wait until ready" gate ──
  const [committedSong, setCommittedSong] = useState<{ seed: string | number | undefined; lines: Line[] }>(
    () => ({ seed, lines }),
  )
  const linesRef = useRef(lines)
  linesRef.current = lines
  const lyricsSig = lines.length === 0 ? "" : `${lines.length}|${lines[0]?.fullText ?? ""}`
  const committedSig = committedSong.lines.length === 0 ? "" : `${committedSong.lines.length}|${committedSong.lines[0]?.fullText ?? ""}`
  useEffect(() => {
    if (seed === committedSong.seed) {
      if (lyricsSig !== committedSig) setCommittedSong({ seed, lines: linesRef.current })
      return undefined
    }
    if (lyricsSig !== "") {
      setCommittedSong({ seed, lines: linesRef.current })
      return undefined
    }
    let raf = 0
    let sawReset = false
    const startWall = performance.now()
    const watch = () => {
      const t = currentTime.get()
      const capped = performance.now() - startWall >= READY_GRACE_MS
      if (!sawReset && t < 1) sawReset = true
      if ((sawReset && t >= INSTRUMENTAL_COMMIT_SECONDS) || capped) {
        setCommittedSong({ seed, lines: linesRef.current })
        return
      }
      raf = requestAnimationFrame(watch)
    }
    raf = requestAnimationFrame(watch)
    return () => cancelAnimationFrame(raf)
  }, [seed, lyricsSig, committedSong.seed, committedSig, currentTime])

  const gatedSeed = committedSong.seed
  const gatedLines = committedSong.lines

  const isInstrumental = gatedLines.length === 0
  const phantomLines = useMemo(() => buildInstrumentalPhantomLines(), [gatedSeed])
  const effectiveLines = isInstrumental ? phantomLines : gatedLines

  const instrumentalIndexRef = useRef(0)
  const [instrumentalIndex, setInstrumentalIndex] = useState(0)
  const instrumentalSeedRef = useRef<string | number | undefined>(undefined)
  useEffect(() => {
    if (!isInstrumental) return undefined
    instrumentalIndexRef.current = 0
    setInstrumentalIndex(0)
    instrumentalSeedRef.current = gatedSeed
    let raf = 0
    const tick = () => {
      const t = currentTime.get()
      const idx = Math.min(Math.max(Math.floor(t / INSTRUMENTAL_SECONDS_PER_FRAME), 0), INSTRUMENTAL_FRAMES - 1)
      if (idx !== instrumentalIndexRef.current) {
        instrumentalIndexRef.current = idx
        setInstrumentalIndex(idx)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isInstrumental, gatedSeed, currentTime])

  const instrumentalReadHead = instrumentalSeedRef.current === gatedSeed ? instrumentalIndex : 0
  const effectiveLineIndex = isInstrumental ? instrumentalReadHead : currentLineIndex

  // ── Transition state machine ──
  const seqRef = useRef(createSequencerState())
  const lastLocalIndexRef = useRef(0)
  const hasEverActiveRef = useRef(false)
  const lastActiveKeyRef = useRef<string | null>(null)
  const transitionEpochRef = useRef(0)
  const [transition, setTransition] = useState<DioramaTransitionState | null>(null)

  const seq = seqRef.current
  const outgoingSeg = activeSegment(seq)
  const outgoingLocal = outgoingSeg
    ? Math.min(Math.max(lastLocalIndexRef.current, 0), outgoingSeg.span - 1)
    : 0
  const outgoingGlobal = outgoingSeg ? outgoingSeg.globalStart + outgoingLocal : 0

  const isNewSong = !outgoingSeg || outgoingSeg.seed !== gatedSeed
  const lyricsChanged = !isNewSong && !!outgoingSeg && outgoingSeg.lines !== effectiveLines
  const isLoopRestart =
    !!outgoingSeg && !isNewSong && effectiveLineIndex >= 0 && effectiveLineIndex <= LOOP_RESTART_MAX_INDEX
    && lastLocalIndexRef.current > effectiveLineIndex

  if (isNewSong) {
    let placementOrigin: DioramaVec = { x: 0, y: 0, z: 0 }
    if (outgoingSeg) {
      const anchor = getFrame(outgoingSeg.frames, outgoingLocal).position
      const off = pickTransitionOffset(gatedSeed ?? "pixel", transitionEpochRef.current + 1)
      placementOrigin = { x: anchor.x + off.x, y: anchor.y + off.y, z: anchor.z + off.z }
    }
    appendSegment(seq, { seed: gatedSeed ?? "pixel", lines: effectiveLines, round: 0, placementOrigin })
  } else if (lyricsChanged) {
    updateActiveSegmentLines(seq, effectiveLines)
  }

  const activeSeg = activeSegment(seq)!
  const keyChanged = activeSeg.key !== lastActiveKeyRef.current
  const hadPrevious = lastActiveKeyRef.current !== null
  if (keyChanged) {
    lastActiveKeyRef.current = activeSeg.key
    lastLocalIndexRef.current = 0
    hasEverActiveRef.current = false
  }
  if (isLoopRestart) {
    lastLocalIndexRef.current = 0
    hasEverActiveRef.current = false
  }
  const startingTransition = (keyChanged && hadPrevious) || isLoopRestart
  if (startingTransition) {
    transitionEpochRef.current += 1
    setTransition({ epoch: transitionEpochRef.current, outgoingIndex: outgoingGlobal })
  }
  if (effectiveLineIndex >= 0) {
    lastLocalIndexRef.current = effectiveLineIndex
    hasEverActiveRef.current = true
  }
  const rawLocalIndex = effectiveLineIndex >= 0 ? effectiveLineIndex : lastLocalIndexRef.current
  const localPositionIndex = Math.min(Math.max(rawLocalIndex, 0), Math.max(activeSeg.span - 1, 0))
  const globalIndex = activeSeg.globalStart + localPositionIndex

  // 预解析当前行的 frame 数据，避免 PixelCameraRig 和 PixelScene 各自重复调用 resolveGlobal
  const activeResolved = useMemo(() => resolveGlobal(seq, globalIndex), [seq, globalIndex])

  const activeOutgoingIndex = startingTransition
    ? outgoingGlobal
    : transition ? transition.outgoingIndex : null
  const pruneFrom = activeOutgoingIndex != null ? Math.min(globalIndex, activeOutgoingIndex) : globalIndex
  pruneSegments(seq, pruneFrom - PRUNE_MARGIN_BEHIND)

  useEffect(() => {
    if (!transition) return undefined
    const id = window.setTimeout(() => setTransition(null), TRANSITION_DURATION * 1000)
    return () => window.clearTimeout(id)
  }, [transition])

  const showWaiting = showText && !hasEverActiveRef.current

  const tuning = dioramaTuning ?? DEFAULT_DIORAMA_TUNING
  const emptyFontSize = `clamp(${(1.5 * lyricsFontScale).toFixed(3)}rem, ${(3.5 * lyricsFontScale).toFixed(3)}vw, ${(2.25 * lyricsFontScale).toFixed(3)}rem)`

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0.6, 9], fov: 55 }}
          dpr={canvasDpr}
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <PixelCameraRig
            currentTime={currentTime}
            globalIndex={globalIndex}
            activeResolved={activeResolved}
            activeLineWidthRef={activeLineWidthRef}
            motion={motionParams}
            transitionEpoch={transitionEpochRef.current}
          />
          <PixelScene
            theme={theme}
            sequencer={seq}
            globalIndex={globalIndex}
            activeResolved={activeResolved}
            transitionOutgoingIndex={transition?.outgoingIndex ?? null}
            currentTime={currentTime}
            activeLineWidthRef={activeLineWidthRef}
            audioPower={audioPower}
            audioBands={audioBands}
            motion={motionParams}
            showLyrics={showText}
            showParticles={tuning.showParticles}
            backgroundParticleCircumference={tuning.backgroundParticleCircumference}
            backgroundParticleRadial={tuning.backgroundParticleRadial}
            geometryVisibility={tuning.geometryVisibility}
            particleDensity={tuning.particleDensity}
            particleScale={tuning.particleScale}
            particleGlowEnabled={tuning.particleGlowEnabled}
            particleGlowIntensity={tuning.particleGlowIntensity}
            lyricsFontScale={lyricsFontScale}
            glowIntensity={tuning.glowEnabled ? tuning.glowIntensity : 0}
            soulIntensity={tuning.soulEnabled ? tuning.soulIntensity : 0}
            soulActiveEnabled={tuning.soulEnabled && tuning.soulActiveEnabled}
            gradientIntensity={tuning.gradientEnabled ? tuning.gradientIntensity : 0}
            keywordColoringEnabled={tuning.keywordColoringEnabled}
          />
        </Canvas>
      </div>

      <div className="relative z-10 w-full h-[70vh] flex items-end justify-center p-8 pointer-events-none">
        <AnimatePresence mode="wait">
          {showWaiting ? (
            <motion.div
              key="pixel-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-2xl opacity-50 absolute"
              style={{ color: theme.secondaryColor, fontSize: emptyFontSize }}
            >
              等待音乐
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default PixelVisualizer