import * as THREE from 'three'

/**
 * 螺旋星系分层色板派生层
 *
 * 设计动机：原实现把 theme 的 3 个高明度紫直接贴到星尘/星云/核心/文字所有图层，
 * AdditiveBlending 叠加后过曝发白、无纵深，且高亮文字与背景撞色。
 *
 * 这里以「封面主色相」为唯一锚点，用 HSL 空间派生出一组**职责分明**的颜色：
 * - 背景层压到极低明度（保留色相，避免死黑）
 * - 星尘内暖外冷、拉开明度差（星系纵深感）
 * - 星云低明度补色（有存在感但不糊）
 * - 高亮文字往互补方向拉高饱和（从紫雾里跳出来）
 */

export interface GalaxyPalette {
  /** 深空底色 / 雾色 */
  deepSpace: THREE.Color
  /** 星尘内圈（暖、亮） */
  starInner: THREE.Color
  /** 星尘外圈（冷、暗、高饱和） */
  starOuter: THREE.Color
  /** 星云光雾 3 片 */
  nebula: [THREE.Color, THREE.Color, THREE.Color]
  /** 核心辉光（近白暖光） */
  coreGlow: THREE.Color
  /** 常态文字（近白，最高可读性） */
  textNormal: THREE.Color
  /** 已唱远行文字（冷却退场，冷暗色） */
  textPast: THREE.Color
  /** 当前演唱字（高饱和强调，必须跳出背景） */
  textActive: THREE.Color
  /** 当前演唱字辉光 */
  textGlow: THREE.Color
}

/** 色相角（度）归一化到 [0,1) */
const wrapHue = (deg: number): number => (((deg % 360) + 360) % 360) / 360

/** HSL → THREE.Color（sRGB 工作空间） */
const hsl = (hDeg: number, s: number, l: number): THREE.Color =>
  new THREE.Color().setHSL(wrapHue(hDeg), s, l, THREE.SRGBColorSpace)

/**
 * 由封面主色相派生整套星系色板。
 *
 * @param hueDeg 主色相（度），通常取自专辑封面
 */
export const deriveGalaxyPalette = (hueDeg: number): GalaxyPalette => ({
  deepSpace: hsl(hueDeg, 0.35, 0.06),
  starInner: hsl(hueDeg - 20, 0.55, 0.72),
  starOuter: hsl(hueDeg + 15, 0.70, 0.32),
  nebula: [
    hsl(hueDeg, 0.40, 0.28),
    hsl(hueDeg - 30, 0.50, 0.30),
    hsl(hueDeg + 25, 0.45, 0.22),
  ],
  coreGlow: hsl(hueDeg - 25, 0.30, 0.88),
  textNormal: hsl(hueDeg, 0.06, 0.98),
  textPast: hsl(hueDeg + 15, 0.45, 0.55),
  textActive: hsl(hueDeg - 45, 0.90, 0.70),
  textGlow: hsl(hueDeg - 45, 0.85, 0.82),
})

/** 深拷贝色板（用于每帧阻尼过渡的可变副本） */
export const clonePalette = (p: GalaxyPalette): GalaxyPalette => ({
  deepSpace: p.deepSpace.clone(),
  starInner: p.starInner.clone(),
  starOuter: p.starOuter.clone(),
  nebula: [p.nebula[0].clone(), p.nebula[1].clone(), p.nebula[2].clone()],
  coreGlow: p.coreGlow.clone(),
  textNormal: p.textNormal.clone(),
  textPast: p.textPast.clone(),
  textActive: p.textActive.clone(),
  textGlow: p.textGlow.clone(),
})

/** 将 from 就地向 to 插值（切歌换色时平滑过渡） */
export const lerpPalette = (from: GalaxyPalette, to: GalaxyPalette, k: number): void => {
  from.deepSpace.lerp(to.deepSpace, k)
  from.starInner.lerp(to.starInner, k)
  from.starOuter.lerp(to.starOuter, k)
  from.nebula[0].lerp(to.nebula[0], k)
  from.nebula[1].lerp(to.nebula[1], k)
  from.nebula[2].lerp(to.nebula[2], k)
  from.coreGlow.lerp(to.coreGlow, k)
  from.textNormal.lerp(to.textNormal, k)
  from.textPast.lerp(to.textPast, k)
  from.textActive.lerp(to.textActive, k)
  from.textGlow.lerp(to.textGlow, k)
}

/** 从 CSS hsl(...) 或 hex 色值解析主色相（度）；失败回退默认紫 258° */
export const parseHueFromColor = (color: string | undefined, fallback = 258): number => {
  if (!color) return fallback
  const hslMatch = color.match(/hsl\(\s*([\d.]+)/i)
  if (hslMatch) return parseFloat(hslMatch[1])
  try {
    const out = { h: 0, s: 0, l: 0 }
    new THREE.Color(color).getHSL(out, THREE.SRGBColorSpace)
    return out.h * 360
  } catch {
    return fallback
  }
}