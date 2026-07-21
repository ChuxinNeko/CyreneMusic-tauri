import type { LyricLineData } from "@/components/player/parser"
import type { DefaultTuning, Line, Theme } from "./default-types"

export const SUPER_CYRENE_DEFAULT_THEME: Theme = {
  name: "Super Cyrene",
  backgroundColor: "transparent",
  primaryColor: "#ffffff",
  accentColor: "#ddd6fe",
  secondaryColor: "#c4b5fd",
  fontStyle: "sans",
  animationIntensity: "normal",
}

export const SUPER_CYRENE_DEFAULT_TUNING: DefaultTuning = {
  disableGeometricBackground: true,
  backgroundObjectOpacity: 0,
  hidePrintSymbols: false,
  textHoldRatio: 1,
  cameraTrackingMode: "smooth",
  cameraSpeed: 1,
  glowIntensity: 1,
  heroScale: 1,
}

export function adaptLyricsForDefault(lines: readonly LyricLineData[]): Line[] {
  return lines
    .map((line, index) => ({
      id: `${line.startTime}-${index}`,
      fullText: line.words.map((word) => word.text).join(""),
      startTime: line.startTime / 1000,
      endTime: line.endTime / 1000,
      translation: line.translation,
      words: line.words.map((word) => ({
        text: word.text,
        startTime: word.startTime / 1000,
        endTime: word.endTime / 1000,
      })),
    }))
    .filter((line) => line.fullText.trim().length > 0)
}