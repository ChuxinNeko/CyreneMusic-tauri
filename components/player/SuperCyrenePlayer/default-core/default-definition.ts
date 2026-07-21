import type { MotionValue } from "framer-motion"
import type { AudioBands, DefaultTuning, Line, Theme } from "./default-types"

export interface VisualizerSharedProps {
  currentTime: MotionValue<number>
  currentLineIndex: number
  lines: Line[]
  theme: Theme
  subtitleTheme?: Theme
  audioPower: MotionValue<number>
  audioBands: AudioBands
  showText?: boolean
  seed?: string | number
  staticMode?: boolean
  lyricsFontScale?: number
  defaultTuning?: DefaultTuning
  subtitleOverlayOpacity?: number
  subtitleOverlayBackground?: boolean
  isPlayerChromeHidden?: boolean
  hideTranslationSubtitle?: boolean
  showSubtitleTranslation?: boolean
  paused?: boolean
  background?: {
    common?: {
      disableGeometricBackground?: boolean
    }
  }
}