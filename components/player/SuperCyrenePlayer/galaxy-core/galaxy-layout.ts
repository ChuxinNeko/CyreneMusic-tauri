import type { Line } from '../default-core/default-types'
import { splitLyricGraphemes, type GraphemeTiming } from './galaxy-graphemeTiming'
import { measureGalaxyText, GALAXY_RASTER_FONT_PX } from './galaxy-textRaster'
import type { GalaxyUnit, GalaxyUnitPlacement } from './galaxy-types'

const CJK_GRAPHEME_RE = /[\u2f00-\u9fff\u3040-\u30ff\uff66-\uff9f\uF900-\uFAFF\uFF66-\uFF9F\u2022\u00B7\u25A0-\u2BFF]/

const LINE_FONT_SIZE = 0.62
const LINE_BAND_EM = 1.4
const WORLD_PER_PX = LINE_FONT_SIZE / GALAXY_RASTER_FONT_PX

/**
 * 将一行歌词拆成星系单元。
 *
 * CJK 每字一个单元，拉丁文每词一个单元，空格跳过。
 * 逻辑与 flip-layout.buildFlipUnits 一致。
 */
export const buildGalaxyUnits = (line: Line, timeline: GraphemeTiming[]): GalaxyUnit[] => {
  if (timeline.length === 0) return []
  const graphemes = splitLyricGraphemes(line.fullText)
  const charOffsets: number[] = []
  let acc = 0
  for (const g of graphemes) { charOffsets.push(acc); acc += g.length }

  const units: GalaxyUnit[] = []
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

/** 根据单元的像素宽度计算每个单元的世界坐标（可读状态） */
export const buildGalaxyPlacements = (
  units: GalaxyUnit[],
  lineText: string,
  fontSpec: string,
): GalaxyUnitPlacement[] => {
  const totalPx = measureGalaxyText(lineText, fontSpec)
  const placements: GalaxyUnitPlacement[] = []
  for (const unit of units) {
    const prefixPx = measureGalaxyText(lineText.slice(0, unit.charStart), fontSpec)
    const unitPx = measureGalaxyText(lineText.slice(unit.charStart, unit.charEnd), fontSpec)
    placements.push({
      centerX: (-totalPx / 2 + prefixPx + unitPx / 2) * WORLD_PER_PX,
      width: Math.max(unitPx * WORLD_PER_PX, 0.08),
      height: LINE_FONT_SIZE * LINE_BAND_EM,
    })
  }
  return placements
}

/** 整行歌词的总宽度（世界单位），用于螺旋展开角估算 */
export const measureLineWidth = (lineText: string, fontSpec: string): number =>
  measureGalaxyText(lineText, fontSpec) * WORLD_PER_PX