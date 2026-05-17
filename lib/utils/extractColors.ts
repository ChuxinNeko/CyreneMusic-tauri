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
    count: number = 6
): Promise<string[]> {
    if (colorCache.has(imageUrl)) {
        return colorCache.get(imageUrl)!
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
    // 默认渐变色板（蓝紫系）
    const defaults = [
        'hsl(220, 80%, 60%)',
        'hsl(260, 70%, 55%)',
        'hsl(280, 65%, 50%)',
        'hsl(200, 75%, 55%)',
        'hsl(320, 60%, 55%)',
        'hsl(240, 70%, 60%)',
    ]
    return defaults.slice(0, count)
}

async function doExtract(imageUrl: string, count: number): Promise<string[]> {
    const img = await loadImage(imageUrl)

    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No canvas context')

    ctx.drawImage(img, 0, 0, size, size)
    const imageData = ctx.getImageData(0, 0, size, size)
    const pixels = imageData.data

    // 收集所有像素的 HSL 值
    const hslPixels: [number, number, number][] = []
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] / 255
        const g = pixels[i + 1] / 255
        const b = pixels[i + 2] / 255
        const [h, s, l] = rgbToHsl(r, g, b)

        // 过滤掉过暗、过亮、低饱和度的颜色
        if (s > 0.15 && l > 0.15 && l < 0.85) {
            hslPixels.push([h, s, l])
        }
    }

    if (hslPixels.length < count) {
        return getDefaultColors(count)
    }

    // 简单的区域采样策略：将色相空间分成 count 个扇区，从每个扇区取最高饱和度的颜色
    const sectors: [number, number, number][][] = Array.from({ length: count }, () => [])
    for (const pixel of hslPixels) {
        const sectorIndex = Math.min(Math.floor(pixel[0] / 360 * count), count - 1)
        sectors[sectorIndex].push(pixel)
    }

    const result: string[] = []
    for (let i = 0; i < count; i++) {
        const sector = sectors[i]
        if (sector.length > 0) {
            // 取饱和度最高的颜色
            sector.sort((a, b) => b[1] - a[1])
            const [h, s, l] = sector[0]
            result.push(`hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`)
        }
    }

    // 如果某些扇区为空，用相邻颜色填充或用默认色
    while (result.length < count) {
        if (result.length > 0) {
            // 微调已有颜色的色相来填充
            const base = result[result.length % result.length]
            const hueMatch = base.match(/hsl\((\d+)/)
            if (hueMatch) {
                const hue = (parseInt(hueMatch[1]) + 30 + result.length * 15) % 360
                result.push(base.replace(/hsl\(\d+/, `hsl(${hue}`))
            } else {
                result.push(getDefaultColors(1)[0])
            }
        } else {
            return getDefaultColors(count)
        }
    }

    return result.slice(0, count)
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
