import type { Line } from "./default-types"

/**
 * Resolves the lyric line that owns a render timestamp.
 *
 * The playback adapter and the Canvas renderer share this function so the
 * displayed subtitle, print cursor, and camera use one timeline boundary.
 */
export function findTimelineLine(lines: readonly Line[], time: number) {
  let activeIndex = -1

  for (let index = 0; index < lines.length; index += 1) {
    if (time < lines[index]!.startTime) break
    activeIndex = index
  }

  return activeIndex
}