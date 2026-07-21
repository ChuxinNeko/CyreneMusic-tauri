import type { Line, Theme } from "./default-types"

interface DefaultSubtitleOverlayProps {
  showText: boolean
  activeLine: Line | null
  recentCompletedLine: Line | null
  nextLines: Line[]
  theme: Theme
  subtitleTheme?: Theme
  translationFontSize: string
  upcomingFontSize: string
  subtitleOverlayOpacity?: number
  subtitleOverlayBackground?: boolean
  isPlayerChromeHidden?: boolean
  hideTranslationSubtitle?: boolean
  showSubtitleTranslation?: boolean
}

export default function DefaultSubtitleOverlay(props: DefaultSubtitleOverlayProps) {
  if (!props.showText) return null
  return null
}