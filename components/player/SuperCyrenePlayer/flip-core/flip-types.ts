import type { AudioBands, Line, Theme } from '../default-core/default-types'

/** 翻牌矩阵的调参 */
export interface FlipTuning {
  /** 单张翻牌翻转动画时长（秒） */
  flipDuration: number
  /** 歌词行结束后、翻牌回翻前的延迟（秒） */
  flipBackDelay: number
  /** 行间距（世界单位） */
  lineSpacing: number
  /** 相机距离 */
  cameraDistance: number
  /** 当前演唱字的辉光强度 */
  glowIntensity: number
  /** 整体运动幅度 */
  motionAmount: number
}

export const DEFAULT_FLIP_TUNING: FlipTuning = {
  flipDuration: 0.35,
  flipBackDelay: 0.45,
  lineSpacing: 1.15,
  cameraDistance: 5.5,
  glowIntensity: 1,
  motionAmount: 1,
}

/** 一个翻牌单元 = 一个字或一个拉丁词 */
export interface FlipUnit {
  text: string
  charStart: number
  charEnd: number
  startTime: number
  endTime: number
}

/** 单张翻牌的空间布局 */
export interface FlipCardPlacement {
  centerX: number
  width: number
  height: number
}

/** 可见行的预计算数据 */
export interface FlipVisibleLine {
  index: number
  line: Line
  units: FlipUnit[]
  placements: FlipCardPlacement[]
}

export type { AudioBands, Line, Theme }