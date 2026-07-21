"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Pause, Play } from "lucide-react"
import { GlassProgressBar } from "./GlassProgressBar"

const EXPAND_DELAY_MS = 20
const COLLAPSE_DELAY_MS = 120
const HOT_AREA_BOTTOM_BUFFER_PX = 28

interface SuperCyrenePlaybackCapsuleProps {
  currentTime: number
  duration: number
  isPlaying: boolean
  title?: string
  onSeek: (time: number) => void
  onTogglePlay: () => void
}

export function SuperCyrenePlaybackCapsule({
  currentTime,
  duration,
  isPlaying,
  title,
  onSeek,
  onTogglePlay,
}: SuperCyrenePlaybackCapsuleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
  }, [])

  const handleMouseEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    if (expandTimerRef.current || isExpanded) return
    expandTimerRef.current = setTimeout(() => {
      setIsExpanded(true)
      expandTimerRef.current = null
    }, EXPAND_DELAY_MS)
  }

  const handleMouseLeave = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current)
      expandTimerRef.current = null
    }
    if (!isExpanded || collapseTimerRef.current) return
    collapseTimerRef.current = setTimeout(() => {
      setIsExpanded(false)
      collapseTimerRef.current = null
    }, COLLAPSE_DELAY_MS)
  }

  return (
    <div
      className="pointer-events-auto flex w-full justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ paddingBottom: HOT_AREA_BOTTOM_BUFFER_PX, marginBottom: -HOT_AREA_BOTTOM_BUFFER_PX }}
    >
      <motion.section
        layout
        initial={false}
        animate={{
          width: isExpanded ? "100%" : "14rem",
          scale: isExpanded ? 1 : 0.96,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative overflow-hidden rounded-full border border-white/15 bg-black/30 shadow-[0_14px_44px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className={isExpanded ? "px-3 py-2.5" : "px-4 py-2"}
        >
          {isExpanded && (
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-center text-xs font-medium tracking-wide text-white/80">
                {title || "CYRENE"}
              </span>
              <button
                type="button"
                aria-label={isPlaying ? "暂停" : "播放"}
                onClick={onTogglePlay}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/85 text-black shadow-[0_4px_16px_rgba(255,255,255,0.2)] transition-transform hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
              </button>
            </div>
          )}

          <GlassProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
            showLabels={isExpanded}
            labelClassName="text-[10px] text-white/55"
          />
        </motion.div>
      </motion.section>
    </div>
  )
}