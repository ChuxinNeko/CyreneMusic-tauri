/**
 * 螺旋星系数学工具
 *
 * 对数螺旋（logarithmic spiral）参数方程：
 *   r(θ) = r₀ · e^(bθ)
 *
 * 时间沿旋臂向外流动：
 * - 已唱过的行沿近侧旋臂向外、向上漂移（回忆远去）
 * - 即将到来的行沿远侧旋臂从 π 方向向内汇聚（星光聚集）
 * - 当前行在星系核心汇聚为可读文字
 */

// ── 螺旋几何常量 ──
/** 螺旋起始半径（世界单位） */
export const SPIRAL_R0 = 2.2
/** 螺旋增长率（每弧度半径放大 e^b 倍） */
export const SPIRAL_GROWTH = 0.42
/** 垂直增长率（每弧度上升的世界单位） */
export const SPIRAL_VERTICAL = 0.26
/** 相邻歌词行之间的角度偏移（弧度） */
export const LINE_ANGLE_STEP = 1.05
/** 单行字符沿旋臂的最大展开角度（弧度） */
export const MAX_LINE_SPREAD = 1.2
/** 远侧旋臂（未来行）向内盘旋的角度系数，越小越紧 */
export const FUTURE_WIND = 0.72

// ── 缓动函数 ──
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

export const smoothstep = (t: number): number => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

export const easeOutBack = (t: number): number => {
  const c = clamp01(t)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2)
}

/**
 * 逐字辉光包络（[0,1]）：
 *   演唱开始前 fadeIn 秒平滑升起 → 演唱区间保持峰值 → 结束后 fadeOut 秒拖尾落下。
 * 纯时间驱动、无状态，替代"进入区间瞬间点亮 / 离开瞬间熄灭"的硬开关，
 * 让文字虚影具备渐入渐出的余晖感。
 */
export const graphemeGlowEnvelope = (
  now: number, start: number, end: number, fadeIn: number, fadeOut: number,
): number => {
  if (now < start - fadeIn) return 0
  if (now < start) return smoothstep((now - start + fadeIn) / Math.max(fadeIn, 1e-4))
  if (now < end) return 1
  if (now < end + fadeOut) return 1 - smoothstep((now - end) / Math.max(fadeOut, 1e-4))
  return 0
}

// ── 螺旋位置 ──
export interface SpiralPos {
  x: number
  y: number
  z: number
  radius: number
}

/**
 * 计算旋臂上某角度 θ 处的三维位置。
 *
 * @param theta 旋臂角度（弧度），越大越外围
 * @param age   行龄，控制额外外推距离（唱完后继续漂移）
 * @param below 是否位于银盘下方（远侧旋臂 / 未来行）
 */
export const spiralPosition = (theta: number, age: number, below: boolean): SpiralPos => {
  const th = Math.min(Math.max(theta, 0.15), 7)
  const r = SPIRAL_R0 * Math.exp(SPIRAL_GROWTH * th) + age * 0.35
  const ySign = below ? -1 : 1
  return {
    x: r * Math.cos(th),
    y: ySign * (SPIRAL_VERTICAL * th + age * 0.4),
    z: r * Math.sin(th),
    radius: r,
  }
}

/** 近侧旋臂（过去行）角度：随行龄增大而向外 */
export const pastArmAngle = (relPast: number, unitOffset: number, drift: number): number =>
  (relPast + 0.5) * LINE_ANGLE_STEP + unitOffset + drift

/** 远侧旋臂（未来行）角度：从 π 一侧向内盘旋 */
export const futureArmAngle = (relFuture: number, unitOffset: number, drift: number): number =>
  Math.PI - (relFuture + 0.5) * LINE_ANGLE_STEP * FUTURE_WIND + unitOffset - drift * 0.6

/**
 * 计算一行歌词沿旋臂的角度展开量。
 * 根据行的总宽度（世界单位）和所在半径估算弧长对应的角度。
 */
export const lineAngularSpread = (lineWidth: number, radius: number): number =>
  Math.min(MAX_LINE_SPREAD, Math.max(0.2, lineWidth / Math.max(radius, 0.5)))

// ── 确定性随机 ──
/** 基于种子的伪随机数生成器（mulberry32） */
export const seededRandom = (seed: number): (() => number) => {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 简单整数哈希，用于逐字随机偏移 */
export const hashInt = (n: number): number => {
  let x = n | 0
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = (x >>> 16) ^ x
  return (x & 0x7fffffff) / 0x7fffffff
}

/** 可读弧面的曲率：字符越靠两侧，z 越向后弯（环绕感） */
export const arcCurveZ = (x: number): number => 0.3 - 0.026 * x * x