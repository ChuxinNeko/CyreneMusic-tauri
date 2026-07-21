import type { Theme } from "../default-core/default-types"

/**
 * 对话气泡配色派生。
 *
 * 由封面主色相（度）派生一套协调的 hex 颜色，喂给 getBubbleColors：
 *   - accentColor    气泡主强调色（鲜明，来自封面色相）
 *   - primaryColor   近白文字色（左侧气泡文字 / 右侧气泡混入）
 *   - secondaryColor 中暗同色相（左侧气泡基色）
 *   - backgroundColor 深色同色相（右侧浅气泡上的文字色，保证可读）
 *
 * 注意：必须输出 hex（而非 hsl），因为 colorMix.mixColors 只解析 #hex / rgb()。
 */

const wrapHue = (deg: number): number => ((deg % 360) + 360) % 360

/** HSL(h∈度, s/l∈[0,1]) → #rrggbb */
export const hslToHex = (hDeg: number, s: number, l: number): string => {
  const h = wrapHue(hDeg) / 360
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * 把任意封面色相折叠进暖扇区（cozy 基调）。
 *
 * 不做线性插值（会经过绿/青等冷色相），而是用余弦把整个色环映射到
 * [WARM_CENTER ± WARM_SPREAD] 的暖区内：任何封面都得到一个暖色调，
 * 但不同封面仍落在区间内的不同位置，保留一点个性。
 */
const WARM_CENTER = 34
const WARM_SPREAD = 16
const warmizeHue = (hueDeg: number): number =>
  WARM_CENTER + WARM_SPREAD * Math.cos((wrapHue(hueDeg) / 360) * Math.PI * 2)

/**
 * 由封面主色相派生对话气泡配色（覆盖到基础 theme 上）。
 *
 * cozy 版：色相先暖化，再整体降饱和、提亮，模拟暖光灯下的纸片气泡，
 * 弱化原版的鲜明群聊感。
 */
export const deriveChatTheme = (base: Theme, hueDeg: number): Theme => {
  const warmHue = warmizeHue(hueDeg)
  return {
    ...base,
    primaryColor: hslToHex(warmHue, 0.16, 0.95),
    accentColor: hslToHex(warmHue, 0.52, 0.68),
    secondaryColor: hslToHex(warmHue + 8, 0.34, 0.5),
    backgroundColor: hslToHex(warmHue, 0.3, 0.14),
  }
}