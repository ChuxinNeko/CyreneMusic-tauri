// 复用 default-core 的 graphemeTiming，保持单一来源
export {
  splitLyricGraphemes,
  buildLineGraphemeTimeline,
  buildWordGraphemeTimings,
  type GraphemeTiming,
} from '../default-core/graphemeTiming'