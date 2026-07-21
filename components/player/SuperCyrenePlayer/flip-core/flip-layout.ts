import type { Line } from '../default-core/default-types'
import { splitLyricGraphemes, type GraphemeTiming } from './flip-graphemeTiming'
import { measureFlipText, FLIP_RASTER_FONT_PX } from './flip-textRaster'
import type { FlipUnit, FlipCardPlacement } from './flip-types'

const CJK_GRAPHEME_RE = /[\u2f00-\u9fff\u3040-\u30ff\uff66-\uff9f\uF900-\uFAFF\uFF66-\uFF9F\u2022\u00B7\u25A0-\u2BFF]/

const LINE_FONT_SIZE = 0.62
const LINE_BAND_EM = 1.4
const WORLD_PER_PX = LINE_FONT_SIZE / FLIP_RASTER_FONT_PX

/**
 * 将一行歌词拆成翻牌单元。
 *
 * CJK 每字一张牌，拉丁文每词一张牌，空格跳过。
 * 逻辑与 PixelScene.buildLyricUnits 一致。
 */
export const buildFlipUnits = (line: Line, timeline: GraphemeTiming[]): FlipUnit[] => {
  if (timeline.length === 0) return []
  const graphemes = splitLyricGraphemes(line.fullText)
  const charOffsets: number[] = []
  let acc = 0
  for (const g of graphemes) { charOffsets.push(acc); acc += g.length }

  const units: FlipUnit[] = []
  const pushUnit = (from: number, to: number) => {
    const text = graphemes.slice(from, to).join('')
    if (text.trim().length === 0) return
    units.push({
      text,
      charStart: charOffsets[from] ?? 0,
      charEnd: (charOffsets[to - 1] ?? 0) + (graphemes[to - 1]?.length ?? 1),
      startTime: timeline[from].startTime,
      endTime: timeline[to - 1].endTime,
    })
  }

  let i = 0
  while (i < timeline.length) {
    const g = graphemes[i] ?? ''
    if (g.trim().length === 0) { i += 1; continue }
    if (CJK_GRAPHEME_RE.test(g)) { pushUnit(i, i + 1); i += 1; continue }
    const wordIndex = timeline[i].wordIndex
    let j = i + 1
    while (
      j < timeline.length
      && timeline[j].wordIndex === wordIndex
      && (graphemes[j] ?? '').trim().length > 0
      && !CJK_GRAPHEME_RE.test(graphemes[j] ?? '')
    ) { j += 1 }
    pushUnit(i, j)
    i = j
  }
  return units
}

/** 根据单元的像素宽度计算每张牌的世界坐标 */
export const buildFlipPlacements = (
  units: FlipUnit[],
  lineText: string,
  fontSpec: string,
): FlipCardPlacement[] => {
  const totalPx = measureFlipText(lineText, fontSpec)
  const placements: FlipCardPlacement[] = []
  for (const unit of units) {
    const prefixPx = measureFlipText(lineText.slice(0, unit.charStart), fontSpec)
    const unitPx = measureFlipText(lineText.slice(unit.charStart, unit.charEnd), fontSpec)
    placements.push({
      centerX: (-totalPx / 2 + prefixPx + unitPx / 2) * WORLD_PER_PX,
      width: Math.max(unitPx * WORLD_PER_PX, 0.08),
      height: LINE_FONT_SIZE * LINE_BAND_EM,
    })
  }
  return placements
}