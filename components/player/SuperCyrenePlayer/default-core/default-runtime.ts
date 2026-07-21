import type { Line } from "./default-types"

interface RecentLineInput {
  lines: Line[]
  currentLineIndex: number
  currentTime: number
  getLineEndTime: (line: Line) => number
}

export function getRecentCompletedLine({
  lines,
  currentLineIndex,
  currentTime,
  getLineEndTime,
}: RecentLineInput) {
  for (let index = Math.min(currentLineIndex - 1, lines.length - 1); index >= 0; index -= 1) {
    const line = lines[index]
    if (currentTime >= getLineEndTime(line)) return line
  }

  return null
}

export function getUpcomingLines(lines: Line[], currentLineIndex: number, count: number) {
  return lines.slice(Math.max(currentLineIndex + 1, 0), Math.max(currentLineIndex + 1, 0) + count)
}