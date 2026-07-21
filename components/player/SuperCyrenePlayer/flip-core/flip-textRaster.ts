import * as THREE from 'three'

/**
 * 翻牌矩阵的文字栅格化
 *
 * 与 pixel-textRaster 的区别：不做像素化、不生成 glow 纹理，
 * 产出干净的 LinearFilter 文字纹理，适合翻牌正面贴图。
 */

export const FLIP_RASTER_FONT_PX = 128
const FONT_WEIGHT = 700
const LINE_BAND_EM = 1.4
const PAD_EM = 0.15

export const buildFlipFontSpec = (fontStack: string): string =>
  `${FONT_WEIGHT} ${FLIP_RASTER_FONT_PX}px ${fontStack}`

let measureCtx: CanvasRenderingContext2D | null = null
const getMeasureCtx = (): CanvasRenderingContext2D => {
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    measureCtx = canvas.getContext('2d')!
  }
  return measureCtx
}

export const measureFlipText = (text: string, fontSpec: string): number => {
  const ctx = getMeasureCtx()
  ctx.font = fontSpec
  return ctx.measureText(text).width
}

const makeTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export interface FlipUnitRaster {
  texture: THREE.CanvasTexture
  canvasWidthPx: number
  canvasHeightPx: number
  advancePx: number
}

/** 将单个文字单元绘制为 CanvasTexture（白字透明底） */
export const rasterFlipUnit = (text: string, fontSpec: string): FlipUnitRaster => {
  const em = FLIP_RASTER_FONT_PX
  const pad = Math.ceil(em * PAD_EM)
  const advancePx = Math.max(1, Math.ceil(measureFlipText(text, fontSpec)))
  const canvasWidthPx = advancePx + pad * 2
  const canvasHeightPx = Math.ceil(em * LINE_BAND_EM) + pad * 2

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidthPx
  canvas.height = canvasHeightPx
  const ctx = canvas.getContext('2d')!
  ctx.font = fontSpec
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, pad, canvasHeightPx / 2)

  return { texture: makeTexture(canvas), canvasWidthPx, canvasHeightPx, advancePx }
}