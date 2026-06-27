"use client"

import { useEffect, useRef } from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { extractColorsFromImage } from "@/lib/utils/extractColors"

function buildGradientBg(colors: string[]): string {
    const withAlpha = (hsl: string, a: number) =>
        hsl.replace(/^hsl\(/, "hsla(").replace(/\)$/, `, ${a})`)

    const primary = colors[0]
    const accents = colors.slice(1, 5)
    const accentPositions = ["18% 32%", "82% 28%", "28% 72%", "72% 75%"]

    const gradients: string[] = []
    gradients.push(
        `radial-gradient(ellipse 140% 55% at 50% 0%, ${withAlpha(primary, 0.45)} 0%, ${withAlpha(primary, 0.18)} 50%, transparent 100%)`
    )
    accents.forEach((color, i) => {
        const pos = accentPositions[i % accentPositions.length]
        gradients.push(
            `radial-gradient(ellipse 60% 45% at ${pos}, ${withAlpha(color, 0.30)} 0%, ${withAlpha(color, 0.10)} 50%, transparent 100%)`
        )
    })
    gradients.push(
        `linear-gradient(180deg, ${withAlpha(primary, 0.15)} 0%, transparent 60%)`
    )
    return gradients.join(", ")
}

/**
 * 播放沉浸模式背景：基于当前播放歌曲的专辑封面提取主色调，
 * 全窗口渲染渐变氛围光背景。
 *
 * 使用双层 div 交叉淡入淡出实现切歌时的平滑过渡
 * （CSS background transition 无法对渐变值做插值）。
 */
export function PlaybackImmersiveBackground() {
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isImmersivePlaybackEnabled = useLayoutStore(s => s.isImmersivePlaybackEnabled)

    const frontRef = useRef<HTMLDivElement>(null)
    const backRef = useRef<HTMLDivElement>(null)
    const trackIdRef = useRef<string | null>(null)

    useEffect(() => {
        const front = frontRef.current
        const back = backRef.current
        if (!front || !back) return

        // 未开启或无歌曲时淡出
        if (!isImmersivePlaybackEnabled || !currentTrack?.picUrl) {
            const frontOpacity = parseFloat(front.style.opacity) || 0
            const backOpacity = parseFloat(back.style.opacity) || 0
            const activeEl = frontOpacity >= backOpacity ? front : back
            activeEl.style.transition = "opacity 0.6s ease-out"
            activeEl.style.opacity = "0"
            trackIdRef.current = null
            return
        }

        const trackKey = `${currentTrack.id}-${currentTrack.picUrl}`
        const isFirstLoad = trackIdRef.current === null
        const isSameTrack = trackIdRef.current === trackKey
        if (isSameTrack) return

        let isMounted = true

        extractColorsFromImage(currentTrack.picUrl, 8)
            .then(colors => {
                if (!isMounted || !colors || colors.length === 0) return

                const newBg = buildGradientBg(colors)

                if (isFirstLoad) {
                    // 首次加载：用双 rAF 防纯色闪烁
                    front.style.background = newBg
                    front.style.opacity = "0"
                    front.style.transition = ""
                    front.style.zIndex = "1"
                    back.style.opacity = "0"
                    back.style.zIndex = "0"
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (isMounted && front) {
                                front.style.transition = "opacity 1s ease-out"
                                front.style.opacity = "1"
                            }
                        })
                    })
                } else {
                    // 切歌：双层交叉淡入淡出
                    // 1. 新渐变写入底层（不可见，被顶层遮挡）
                    back.style.transition = ""
                    back.style.background = newBg
                    back.style.opacity = "0"
                    // 2. 强制回流，确保浏览器应用了上面的样式变更
                    void back.offsetHeight
                    // 3. 同时开启过渡：底层淡入 + 顶层淡出
                    front.style.transition = "opacity 0.8s ease-in-out"
                    back.style.transition = "opacity 0.8s ease-in-out"
                    back.style.opacity = "1"
                    front.style.opacity = "0"
                    // 4. 过渡结束后：将新内容拷贝回 front，重置 back
                    setTimeout(() => {
                        if (!isMounted) return
                        front.style.transition = ""
                        front.style.background = newBg
                        front.style.opacity = "1"
                        back.style.transition = ""
                        back.style.opacity = "0"
                    }, 850)
                }

                trackIdRef.current = trackKey
            })
            .catch(e => {
                console.warn("[PlaybackImmersiveBackground] Failed to extract colors:", e)
            })

        return () => {
            isMounted = false
        }
    }, [currentTrack?.picUrl, currentTrack?.id, isImmersivePlaybackEnabled])

    return (
        <div className="fixed inset-0 pointer-events-none -z-10">
            <div
                ref={backRef}
                className="absolute inset-0"
                style={{ opacity: 0, zIndex: 0 }}
            />
            <div
                ref={frontRef}
                className="absolute inset-0"
                style={{ opacity: 0, zIndex: 1 }}
            />
        </div>
    )
}