"use client"

/**
 * 从图片 URL 提取主题色。
 * 通过 Canvas 降采样后按区域采样，取得多个代表色。
 * 返回 CSS 渐变可用的色值字符串数组。
 */

// 缓存：避免同一封面重复提取
const colorCache = new Map<string, string[]>()
const brightnessCache = new Map<string, number>()

export async function extractColorsFromImage(
    imageUrl: string,
    count: number = 10
): Promise<string[]> {
    if (colorCache.has(imageUrl)) {
        return colorCache.get(imageUrl)!.slice(0, count)
    }

    try {
        const colors = await doExtract(imageUrl, count)
        colorCache.set(imageUrl, colors)
        return colors
    } catch (e) {
        console.warn('[extractColors] Failed:', e)
        return getDefaultColors(count)
    }
}

function getDefaultColors(count: number): string[] {
    // 默认渐变色板：覆盖更广的色相环，避免单调
    const defaults = [
        'hsl(0, 70%, 55%)',    // red
        'hsl(30, 80%, 55%)',   // orange
        'hsl(50, 70%, 55%)',   // yellow
        'hsl(140, 60%, 50%)',  // green
        'hsl(180, 70%, 50%)',  // cyan
        'hsl(220, 80%, 60%)',  // blue
        'hsl(260, 70%, 55%)',  // purple
        'hsl(320, 60%, 55%)',  // pink
        'hsl(280, 65%, 50%)',  // magenta
        'hsl(200, 75%, 55%)',  // light blue
    ]
    if (count <= defaults.length) {
        return defaults.slice(0, count)
    }
    // 数量超出时循环填充
    const result: string[] = [...defaults]
    while (result.length < count) {
        result.push(...defaults)
    }
    return result.slice(0, count)
}

async function doExtract(imageUrl: string, count: number): Promise<string[]> {
    const img = await loadImage(imageUrl)

    // 更大的画布以获得更丰富的颜色信息
    const size = 96
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No canvas context')

    ctx.drawImage(img, 0, 0, size, size)
    const imageData = ctx.getImageData(0, 0, size, size)
    const pixels = imageData.data

    // 收集所有像素的 HSL 值（适度放宽过滤以保留更多颜色变化）
    const hslPixels: [number, number, number][] = []
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] / 255
        const g = pixels[i + 1] / 255
        const b = pixels[i + 2] / 255
        const [h, s, l] = rgbToHsl(r, g, b)

        if (s > 0.1 && l > 0.1 && l < 0.9) {
            hslPixels.push([h, s, l])
        }
    }

    if (hslPixels.length < count) {
        return getDefaultColors(count)
    }

    // 精细色相分扇区：固定 16 扇区（每扇 22.5°），保留细微色差
    const sectorCount = 16
    const sectors: [number, number, number][][] = Array.from({ length: sectorCount }, () => [])

    for (const pixel of hslPixels) {
        const sectorIndex = Math.min(Math.floor(pixel[0] / 360 * sectorCount), sectorCount - 1)
        sectors[sectorIndex].push(pixel)
    }

    // 从每个非空扇区抽取多个候选色：
    // - 最高饱和度（视觉冲击）
    // - 中等饱和度（环境过渡）
    // - 较低饱和度（柔和补色，扇区像素足够多时）
    interface Candidate {
        hsl: [number, number, number]
        score: number
    }
    const candidates: Candidate[] = []

    for (const sector of sectors) {
        if (sector.length === 0) continue

        const sorted = [...sector].sort((a, b) => b[1] - a[1])

        // 最高饱和度
        candidates.push({ hsl: sorted[0], score: sorted[0][1] * 3 + 0.1 })

        // 中等饱和度
        if (sorted.length > 12) {
            const mid = sorted[Math.floor(sorted.length * 0.35)]
            candidates.push({ hsl: mid, score: mid[1] * 1.5 + 0.05 })
        }

        // 较低饱和度
        if (sorted.length > 40) {
            const low = sorted[Math.floor(sorted.length * 0.7)]
            candidates.push({ hsl: low, score: low[1] * 0.8 })
        }
    }

    if (candidates.length === 0) {
        return getDefaultColors(count)
    }

    // 贪心多样性选择：
    // 1. 按得分降序
    // 2. 依次挑选，与已选色足够"不同"则入选
    // "足够不同" = 色相差 > 18°  或  (饱和度差 > 0.12 且 明度差 > 0.08)
    const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score)
    const result: [number, number, number][] = []

    const hueDist = (a: number, b: number) => {
        const d = Math.abs(a - b)
        return Math.min(d, 360 - d)
    }

    const isDiverseEnough = (
        candidate: [number, number, number],
        selected: [number, number, number]
    ) => {
        const hueDiff = hueDist(candidate[0], selected[0])
        const satDiff = Math.abs(candidate[1] - selected[1])
        const lightDiff = Math.abs(candidate[2] - selected[2])
        return hueDiff > 18 || (satDiff > 0.12 && lightDiff > 0.08)
    }

    for (const candidate of sortedCandidates) {
        if (result.length >= count) break
        if (result.every(r => isDiverseEnough(candidate.hsl, r))) {
            result.push(candidate.hsl)
        }
    }

    // 若多样性约束导致数量不足，用剩余高分候选补齐
    if (result.length < count) {
        for (const candidate of sortedCandidates) {
            if (result.length >= count) break
            if (!result.some(r =>
                r[0] === candidate.hsl[0] &&
                r[1] === candidate.hsl[1] &&
                r[2] === candidate.hsl[2]
            )) {
                result.push(candidate.hsl)
            }
        }
    }

    return result.map(([h, s, l]) => `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`)
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2

    if (max === min) return [0, 0, l]

    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    let h = 0
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6

    return [h * 360, s, l]
}

/**
 * 计算图片的感知亮度 (0~1)。
 * 用于判断封面是否为浅色，以便动态调整 UI 对比度。
 */
export async function extractBrightnessFromImage(imageUrl: string): Promise<number> {
    if (brightnessCache.has(imageUrl)) {
        return brightnessCache.get(imageUrl)!
    }

    try {
        const img = await loadImage(imageUrl)
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return 0.5

        ctx.drawImage(img, 0, 0, size, size)
        const imageData = ctx.getImageData(0, 0, size, size)
        const pixels = imageData.data

        let totalLuminance = 0
        const pixelCount = pixels.length / 4
        for (let i = 0; i < pixels.length; i += 4) {
            // 相对亮度公式 (sRGB)
            const r = pixels[i] / 255
            const g = pixels[i + 1] / 255
            const b = pixels[i + 2] / 255
            totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b
        }

        const brightness = totalLuminance / pixelCount
        brightnessCache.set(imageUrl, brightness)
        return brightness
    } catch {
        return 0.5
    }
}