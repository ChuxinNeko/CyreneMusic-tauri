import * as THREE from 'three'

/**
 * 螺旋星系的文字栅格化
 *
 * 产出白字透明底的 CanvasTexture，并额外生成一张模糊 glow 纹理，
 * 用于当前演唱字符的加色辉光层（AdditiveBlending）。
 */

export const GALAXY_RASTER_FONT_PX = 128
const FONT_WEIGHT = 700
const LINE_BAND_EM = 1.4
const PAD_EM = 0.2

export const buildGalaxyFontSpec = (fontStack: string): string =>
  `${FONT_WEIGHT} ${GALAXY_RASTER_FONT_PX}px ${fontStack}`

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

export const measureGalaxyText = (text: string, fontSpec: string): number => {
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

export interface GalaxyUnitRaster {
  texture: THREE.CanvasTexture
  glowTexture: THREE.CanvasTexture
  canvasWidthPx: number
  canvasHeightPx: number
  advancePx: number
}

/** 将单个文字单元绘制为 CanvasTexture（白字透明底）+ 模糊 glow 纹理 */
export const rasterGalaxyUnit = (text: string, fontSpec: string): GalaxyUnitRaster => {
  const em = GALAXY_RASTER_FONT_PX
  const pad = Math.ceil(em * PAD_EM)
  const advancePx = Math.max(1, Math.ceil(measureGalaxyText(text, fontSpec)))
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

  // glow 纹理：同尺寸画布上以 shadowBlur 重绘，产生柔和光晕
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = canvasWidthPx
  glowCanvas.height = canvasHeightPx
  const gCtx = glowCanvas.getContext('2d')!
  gCtx.font = fontSpec
  gCtx.textAlign = 'left'
  gCtx.textBaseline = 'middle'
  gCtx.shadowColor = '#ffffff'
  gCtx.shadowBlur = em * 0.22
  gCtx.fillStyle = '#ffffff'
  // 多次叠绘增强光晕
  for (let i = 0; i < 3; i++) {
    gCtx.fillText(text, pad, canvasHeightPx / 2)
  }

  return {
    texture: makeTexture(canvas),
    glowTexture: makeTexture(glowCanvas),
    canvasWidthPx,
    canvasHeightPx,
    advancePx,
  }
}