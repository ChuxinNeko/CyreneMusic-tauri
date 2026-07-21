import * as THREE from "three"

// ── 颜文字列表 ──
// 每个颜文字会被光栅化到 atlas 的一个 cell 中
export const KAOMOJI_LIST: readonly string[] = [
  "(◕‿◕)",
  "(｡♥‿♥｡)",
  "(⊙_⊙)",
  "(・_・)",
  "(^_^)",
  "(•‿•)",
  "(◠‿◠)",
  "(¬‿¬)",
  "(◑‿◐)",
  "(▰˘◡˘▰)",
  "( ˘ ³˘)",
  "(◡‿◡)",
  "(◕ᴗ◕✿)",
  "(˘▾˘)",
  "(◕‿ↀ)",
  "(∪◕˱◡˲◕∪)",
  "(✿╹◡╹)",
  "(´• ω •`)",
  "(●´ω｀●)",
  "(๑•̀ㅂ•́)✧",
  "(っ˘ω˘ς)",
  "(◉ω◉)",
  "(°▽°)",
  "(≧◡≦)",
] as const

const ATLAS_COLS = 4
const ATLAS_CELL_PX = 224
const ATLAS_FONT_PX = 52
const ATLAS_FONT = `600 ${ATLAS_FONT_PX}px "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`

export interface KaomojiAtlas {
  texture: THREE.Texture
  cols: number
  rows: number
  count: number
  cellPx: number
}

let cachedAtlas: KaomojiAtlas | null = null

/**
 * 构建颜文字纹理图集（单例，首次调用时创建，之后复用）
 *
 * 将所有颜文字光栅化到一张 canvas 上，按 ATLAS_COLS × rows 网格排列。
 * cell 为正方形（224×224），字体 52px，留出充足 padding 避免两侧裁剪。
 * 每个粒子通过 aKaomojiIndex 属性索引到对应 cell。
 */
export const buildKaomojiAtlas = (): KaomojiAtlas => {
  if (cachedAtlas) return cachedAtlas

  const count = KAOMOJI_LIST.length
  const rows = Math.ceil(count / ATLAS_COLS)
  const canvasWidth = ATLAS_COLS * ATLAS_CELL_PX
  const canvasHeight = rows * ATLAS_CELL_PX

  const canvas = document.createElement("canvas")
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext("2d")!

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.font = ATLAS_FONT
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#ffffff"

  for (let i = 0; i < count; i += 1) {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    const cx = col * ATLAS_CELL_PX + ATLAS_CELL_PX / 2
    const cy = row * ATLAS_CELL_PX + ATLAS_CELL_PX / 2
    ctx.fillText(KAOMOJI_LIST[i], cx, cy)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.flipY = true

  cachedAtlas = { texture, cols: ATLAS_COLS, rows, count, cellPx: ATLAS_CELL_PX }
  return cachedAtlas
}