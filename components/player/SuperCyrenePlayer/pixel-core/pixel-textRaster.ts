import * as THREE from 'three';

export const DIORAMA_RASTER_FONT_PX = 128;
const FONT_WEIGHT = 700;
const LINE_BAND_EM = 1.4;
const GLOW_PAD_EM = 0.7;
const PLAIN_PAD_EM = 0.2;
const MAX_CANVAS_PX = 4096;
const GLOW_BLUR_EM = 0.16;

// ── 像素化参数 ──
// 将光栅化后的 canvas 缩小到低分辨率再放大回去，产生像素马赛克效果。
// PIXEL_BLOCK_PX 越大，像素块越大，风格越粗犷。
const PIXEL_BLOCK_PX = 8;

export const buildDioramaFontSpec = (fontStack: string): string =>
    `${FONT_WEIGHT} ${DIORAMA_RASTER_FONT_PX}px ${fontStack}`;

let measureCtx: CanvasRenderingContext2D | null = null;
const getMeasureCtx = (): CanvasRenderingContext2D => {
    if (!measureCtx) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        measureCtx = canvas.getContext('2d')!;
    }
    return measureCtx;
};

export const measureDioramaText = (text: string, fontSpec: string): number => {
    const ctx = getMeasureCtx();
    ctx.font = fontSpec;
    return ctx.measureText(text).width;
};

const makeTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
};

/**
 * 将 canvas 内容像素化：缩小到低分辨率再放大回去。
 * 使用 nearest-neighbor 采样产生硬边像素块。
 */
const pixelateCanvas = (source: HTMLCanvasElement): HTMLCanvasElement => {
    const w = source.width;
    const h = source.height;
    const smallW = Math.max(1, Math.floor(w / PIXEL_BLOCK_PX));
    const smallH = Math.max(1, Math.floor(h / PIXEL_BLOCK_PX));

    const small = document.createElement('canvas');
    small.width = smallW;
    small.height = smallH;
    const smallCtx = small.getContext('2d')!;
    smallCtx.imageSmoothingEnabled = false;
    smallCtx.drawImage(source, 0, 0, smallW, smallH);

    const result = document.createElement('canvas');
    result.width = w;
    result.height = h;
    const resultCtx = result.getContext('2d')!;
    resultCtx.imageSmoothingEnabled = false;
    resultCtx.drawImage(small, 0, 0, w, h);
    return result;
};

const drawGlowGlyph = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, blur: number) => {
    const OFFSCREEN = 10000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffffff';
    const haloPass = (passBlur: number, alpha: number) => {
        ctx.shadowColor = `rgba(255,255,255,${alpha})`;
        ctx.shadowBlur = passBlur;
        ctx.shadowOffsetX = OFFSCREEN;
        ctx.shadowOffsetY = 0;
        ctx.fillText(text, x - OFFSCREEN, y);
    };
    haloPass(blur, 0.95);
    haloPass(blur, 0.85);
    haloPass(blur * 2, 0.55);
    haloPass(blur * 2.9, 0.3);
    ctx.restore();
};

export interface DioramaUnitRaster {
    baseTexture: THREE.CanvasTexture;
    glowTexture: THREE.CanvasTexture;
    canvasWidthPx: number;
    canvasHeightPx: number;
    advancePx: number;
}

export const rasterDioramaUnit = (text: string, fontSpec: string): DioramaUnitRaster => {
    const em = DIORAMA_RASTER_FONT_PX;
    const pad = Math.ceil(em * GLOW_PAD_EM);
    const advancePx = Math.max(1, Math.ceil(measureDioramaText(text, fontSpec)));
    const canvasWidthPx = advancePx + pad * 2;
    const canvasHeightPx = Math.ceil(em * LINE_BAND_EM) + pad * 2;
    const drawX = pad;
    const drawY = canvasHeightPx / 2;

    const draw = (paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidthPx;
        canvas.height = canvasHeightPx;
        const ctx = canvas.getContext('2d')!;
        ctx.font = fontSpec;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        paint(ctx);
        const pixelated = pixelateCanvas(canvas);
        return makeTexture(pixelated);
    };

    const baseTexture = draw((ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, drawX, drawY);
    });
    const glowTexture = draw((ctx) => {
        drawGlowGlyph(ctx, text, drawX, drawY, em * GLOW_BLUR_EM);
    });

    return { baseTexture, glowTexture, canvasWidthPx, canvasHeightPx, advancePx };
};

export interface DioramaLineRaster {
    texture: THREE.CanvasTexture;
    canvasWidthPx: number;
    canvasHeightPx: number;
    advancePx: number;
    fontPx: number;
}

export const rasterDioramaLine = (text: string, fontStack: string): DioramaLineRaster => {
    let fontPx = DIORAMA_RASTER_FONT_PX;
    let fontSpec = buildDioramaFontSpec(fontStack);
    let advancePx = Math.max(1, Math.ceil(measureDioramaText(text, fontSpec)));
    const pad = Math.ceil(fontPx * PLAIN_PAD_EM);
    if (advancePx + pad * 2 > MAX_CANVAS_PX) {
        const shrink = (MAX_CANVAS_PX - pad * 2) / advancePx;
        fontPx = Math.max(24, Math.floor(fontPx * shrink));
        fontSpec = `${FONT_WEIGHT} ${fontPx}px ${fontStack}`;
        advancePx = Math.max(1, Math.ceil(measureDioramaText(text, fontSpec)));
    }
    const canvasWidthPx = advancePx + pad * 2;
    const canvasHeightPx = Math.ceil(fontPx * LINE_BAND_EM) + pad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidthPx;
    canvas.height = canvasHeightPx;
    const ctx = canvas.getContext('2d')!;
    ctx.font = fontSpec;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, pad, canvasHeightPx / 2);

    const pixelated = pixelateCanvas(canvas);
    return { texture: makeTexture(pixelated), canvasWidthPx, canvasHeightPx, advancePx, fontPx };
};