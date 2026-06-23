import type { LyricLine, LyricWord } from "@applemusic-like-lyrics/core"
import type { LyricLineData } from "./types"

/**
 * 将项目内部的 LyricLineData[] 转换为 AMLL 的 LyricLine[]
 */
export function toAmllLyricLines(lines: LyricLineData[], showTranslation = true): LyricLine[] {
    return lines.map((line): LyricLine => ({
        startTime: line.startTime,
        endTime: line.endTime,
        translatedLyric: showTranslation ? (line.translation ?? "") : "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
        words: line.isVerbatim
            ? line.words.map((w): LyricWord => ({
                startTime: w.startTime,
                endTime: w.endTime,
                word: w.text,
            }))
            : [{
                startTime: line.startTime,
                endTime: line.endTime,
                word: line.words.map(w => w.text).join(""),
            }],
    }))
}