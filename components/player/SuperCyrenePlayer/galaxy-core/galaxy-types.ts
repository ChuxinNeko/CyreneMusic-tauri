import type { AudioBands, Line, Theme } from '../default-core/default-types'

/** 螺旋星系歌词的调参 */
export interface GalaxyTuning {
  /** 相机距离 */
  cameraDistance: number
  /** 星系整体旋转速度（弧度/秒） */
  spiralDriftSpeed: number
  /** 当前演唱字的辉光强度 */
  glowIntensity: number
  /** 整体运动幅度 */
  motionAmount: number
  /** 字符汇聚到可读位置的动画时长（秒） */
  assembleDuration: number
  /** 字符飞散回螺旋的动画时长（秒） */
  disperseDuration: number
  /** 逐字汇聚的错开延迟（秒/字） */
  staggerDelay: number
  /** 背景星星数量 */
  starCount: number
}

export const DEFAULT_GALAXY_TUNING: GalaxyTuning = {
  cameraDistance: 7,
  spiralDriftSpeed: 0.05,
  glowIntensity: 1,
  motionAmount: 1,
  assembleDuration: 0.55,
  disperseDuration: 0.7,
  staggerDelay: 0.025,
  starCount: 4500,
}

/** 一个星系歌词单元 = 一个字或一个拉丁词（与 FlipUnit 对应） */
export interface GalaxyUnit {
  text: string
  charStart: number
  charEnd: number
  startTime: number
  endTime: number
}

/** 单个字符单元的空间布局（可读状态下的位置） */
export interface GalaxyUnitPlacement {
  centerX: number
  width: number
  height: number
}

/** 单个字符单元的螺旋参数（确定性随机，避免每帧分配） */
export interface GalaxyUnitSpiral {
  /** 旋臂基础角度（含行偏移 + 逐字展开 + 抖动） */
  theta: number
  /** 径向抖动 [-1, 1] */
  radialJitter: number
  /** 垂直抖动 [-1, 1] */
  yJitter: number
  /** 闪烁/浮动相位 [0, 1] */
  phase: number
}

/** 可见行的预计算数据 */
export interface GalaxyVisibleLine {
  index: number
  line: Line
  units: GalaxyUnit[]
  placements: GalaxyUnitPlacement[]
  spirals: GalaxyUnitSpiral[]
  /** 可读状态下的行缩放（长行自动缩小） */
  lineScale: number
  /** 行宽（世界单位） */
  lineWidth: number
}

export type { AudioBands, Line, Theme }