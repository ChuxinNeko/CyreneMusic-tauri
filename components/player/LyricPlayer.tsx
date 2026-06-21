"use client"

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { WordData, LyricLineData, INTRO_DELAY, parseLyrics } from "./parser"

interface LyricLineHelper {
    el: HTMLDivElement
    index: number
    data: LyricLineData
    wordEls: {
        span: HTMLSpanElement
        data: WordData
        width: number
        padding: number
        height: number
        animating: boolean
        maskAnim?: Animation
        floatAnim?: Animation
    }[]
    height: number
}

const ALIGN_POSITION = 0.5
// 增加淡入跑马灯的光晕平滑宽度
const WORD_FADE_WIDTH = 1.0
const LYRIC_TRANSITION = "1000ms cubic-bezier(0.16, 1, 0.3, 1)"

// Helper component for Interlude dots
function InterludeDots({ interludeRef }: { interludeRef: React.RefObject<{ start: number, end: number, lineIndex: number } | null> }) {
    const dot0Ref = useRef<HTMLSpanElement>(null)
    const dot1Ref = useRef<HTMLSpanElement>(null)
    const dot2Ref = useRef<HTMLSpanElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number>(0)

    const targetBreatheDuration = 1500

    useEffect(() => {
        const clamp = (min: number, cur: number, max: number) => Math.max(min, Math.min(cur, max))
        const easeOutExpo = (x: number) => x === 1 ? 1 : 1 - 2 ** (-10 * x)
        const easeInOutBack = (x: number) => {
            const c1 = 1.70158
            const c2 = c1 * 1.525
            return x < 0.5
                ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
                : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
        }

        const tick = () => {
            if (!containerRef.current || !dot0Ref.current || !dot1Ref.current || !dot2Ref.current) {
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            const interlude = interludeRef.current
            if (!interlude) {
                containerRef.current.style.transform = "scale(0)"
                containerRef.current.style.opacity = "0"
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            const time = playerService.getCurrentTime() * 1000 + INTRO_DELAY
            const start = interlude.start
            const end = interlude.end
            const interludeDuration = end - start
            const currentDuration = time - start

            if (interludeDuration <= 0) {
                containerRef.current.style.transform = "scale(0)"
                containerRef.current.style.opacity = "0"
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            if (currentDuration <= interludeDuration && currentDuration >= 0) {
                const breatheDuration = interludeDuration / Math.ceil(interludeDuration / targetBreatheDuration)
                let scale = Math.sin(1.5 * Math.PI - (currentDuration / breatheDuration) * 2) / 20 + 1
                let globalOpacity = 1

                if (currentDuration < 2000) scale *= easeOutExpo(clamp(0, currentDuration / 2000, 1))

                if (currentDuration < 500) globalOpacity = 0
                else if (currentDuration < 1000) globalOpacity *= (currentDuration - 500) / 500

                if (interludeDuration - currentDuration < 750) {
                    scale *= 1 - easeInOutBack(clamp(0, (750 - (interludeDuration - currentDuration)) / 750 / 2, 1))
                }
                if (interludeDuration - currentDuration < 375) {
                    globalOpacity *= clamp(0, (interludeDuration - currentDuration) / 375, 1)
                }

                scale = Math.max(0, scale) * 0.75
                containerRef.current.style.transform = `scale(${scale})`
                containerRef.current.style.opacity = "1"
                containerRef.current.style.transformOrigin = "left center"

                const dotsDuration = Math.max(0, interludeDuration - 750)
                const getRawDotOpacity = (t: number) => {
                    if (dotsDuration <= 0) return 0.25
                    const val = (t * 3 / dotsDuration) * 0.75
                    return clamp(0.25, val, 1.0)
                }

                const d0 = getRawDotOpacity(currentDuration)
                const d1 = getRawDotOpacity(currentDuration - dotsDuration / 3)
                const d2 = getRawDotOpacity(currentDuration - (dotsDuration / 3) * 2)

                const finalize = (dotOp: number) => clamp(0, globalOpacity * dotOp, 1).toString()

                dot0Ref.current.style.opacity = finalize(d0)
                dot1Ref.current.style.opacity = finalize(d1)
                dot2Ref.current.style.opacity = finalize(d2)
            } else {
                containerRef.current.style.transform = "scale(0)"
                containerRef.current.style.opacity = "0"
            }

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }, [])

    return (
        <div
            ref={containerRef}
            className="interlude-dots absolute flex gap-4"
            style={{ transform: 'scale(0)', opacity: 0, transformOrigin: 'left center', height: '40px', alignItems: 'center' }}
        >
            <span ref={dot0Ref} className="w-4 h-4 rounded-full bg-white" />
            <span ref={dot1Ref} className="w-4 h-4 rounded-full bg-white" />
            <span ref={dot2Ref} className="w-4 h-4 rounded-full bg-white" />
        </div>
    )
}

export const LyricPlayer = React.memo(function LyricPlayer({ alignPosition = 'center' }: { alignPosition?: 'center' | 'top-second' }) {
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const isPlaying = usePlayerStore(s => s.isPlaying)
    const showTranslation = usePlayerStore(s => s.showTranslation)
    const lyricFontSize = usePlayerStore(s => s.lyricFontSize)
    const lyricFontFamily = usePlayerStore(s => s.lyricFontFamily)
    const lyricBlurStrength = usePlayerStore(s => s.lyricBlurStrength)
    const containerRef = useRef<HTMLDivElement>(null)
    const linesHelperRef = useRef<LyricLineHelper[]>([])
    const currentScrollIndexRef = useRef(-1)
    const requestRef = useRef<number>(0)
    const lastLoopTimeRef = useRef<number>(0)
    const interludeContainerRef = useRef<HTMLDivElement>(null)

    const [parsedLyrics, setParsedLyrics] = useState<LyricLineData[]>([])
    const interludeRef = useRef<{ start: number, end: number, lineIndex: number } | null>(null)

    // Parse lyrics
    useEffect(() => {
        setParsedLyrics(parseLyrics(currentTrack))
    }, [currentTrack?.lyric, currentTrack?.yrc, currentTrack?.tlyric, currentTrack?.ytlrc])

    // Measurements & Setup
    useEffect(() => {
        if (!containerRef.current || parsedLyrics.length === 0) return

        const playerEl = containerRef.current.querySelector('.lyric-content') as HTMLDivElement
        if (!playerEl) return

        // 清理旧动画避免内存泄漏与重绘冲突
        linesHelperRef.current.forEach(l => l.wordEls.forEach(w => {
            if (w.maskAnim) w.maskAnim.cancel()
            if (w.floatAnim) w.floatAnim.cancel()
        }))

        const lineEls = Array.from(playerEl.querySelectorAll('.lyricLine')) as HTMLDivElement[]
        linesHelperRef.current = parsedLyrics.map((data, index) => {
            const el = lineEls[index]
            if (!el) return null as any

            const wordSpans = Array.from(el.querySelectorAll('.lyricWord')) as HTMLSpanElement[]
            const wordEls = data.words.map((w, j) => {
                const span = wordSpans[j]
                if (!span) return null as any
                const style = getComputedStyle(span)
                const padding = parseFloat(style.paddingLeft) || 0
                return { span, data: w, width: span.clientWidth - padding * 2, padding, height: span.clientHeight - padding * 2, animating: false }
            }).filter(w => w !== null)

            const helper: LyricLineHelper = { el, index, data, wordEls, height: el.clientHeight || 60 }

            wordEls.forEach(w => {
                if (!data.isVerbatim) {
                    // 对于整句歌词（无逐字时间戳），直接全量展示，无需半透明遮罩
                    w.span.style.maskImage = 'none'
                    w.span.style.webkitMaskImage = 'none'
                    return
                }
                const fadeWidth = w.height * WORD_FADE_WIDTH
                const totalAspect = 2 + (fadeWidth / Math.max(1, (w.width + w.padding * 2)))
                const leftPos = (1 - (fadeWidth / Math.max(1, (w.width + w.padding * 2))) / totalAspect) / 2

                // 更平滑的三段式渐变掩码，交界处更柔和
                const p1 = leftPos * 100;
                const p2 = (leftPos + (fadeWidth / Math.max(1, (w.width + w.padding * 2))) / totalAspect) * 100;
                const maskImage = `linear-gradient(to right, 
                    rgba(255,255,255,1.0) 0%, 
                    rgba(255,255,255,1.0) ${p1}%, 
                    rgba(255,255,255,0.4) ${p2}%, 
                    rgba(255,255,255,0.4) 100%)`

                const totalAspectStr = `${totalAspect * 100}% 100%`
                w.span.style.maskImage = maskImage
                w.span.style.webkitMaskImage = maskImage
                w.span.style.maskSize = totalAspectStr
                w.span.style.webkitMaskSize = totalAspectStr
            })
            return helper
        }).filter(l => l !== null)

        // 根据当前播放进度定位到正确的歌词行，而非始终从第 0 行开始
        const realTime = playerService.getCurrentTime()
        const loopTime = realTime * 1000 + INTRO_DELAY
        let initIndex = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (loopTime >= parsedLyrics[i].time) {
                if (loopTime >= parsedLyrics[i].endTime && i + 1 < parsedLyrics.length) {
                    initIndex = i + 1;
                } else {
                    initIndex = i;
                }
            }
        }
        currentScrollIndexRef.current = initIndex
        // 初始化时也检测一次间奏
        const initInterlude = getActiveInterlude(loopTime)
        interludeRef.current = initInterlude
        updateLayoutTargets(initIndex, initInterlude, true)
    }, [parsedLyrics])

    // 翻译行显示/隐藏及设置变更时重新测量行高并更新布局
    useEffect(() => {
        if (linesHelperRef.current.length === 0) return
        // 等待 DOM 更新后重新测量
        requestAnimationFrame(() => {
            linesHelperRef.current.forEach(l => {
                if (l && l.el) l.height = l.el.clientHeight || 60
            })
            const idx = Math.max(0, currentScrollIndexRef.current)
            updateLayoutTargets(idx, null, true)
        })
    }, [showTranslation, lyricFontSize, lyricBlurStrength])

    // 增加视口裁剪逻辑，减少 DOM 渲染压力
    const updateLayoutTargets = (targetIndex: number, activeInterlude: { lineIndex: number } | null, immediate = false) => {
        if (!containerRef.current || linesHelperRef.current.length === 0) return

        const playerHeight = containerRef.current.clientHeight
        const INTERLUDE_TOTAL_HEIGHT = 80
        const VIEWPORT_BUFFER = 8 // 视口附近保留多少行

        let virtualY = 0
        let activeCenterY = 0
        const linesY = new Array(linesHelperRef.current.length).fill(0)
        let interludeY: number | null = null

        if (activeInterlude && activeInterlude.lineIndex === -1) {
            interludeY = virtualY
            virtualY += INTERLUDE_TOTAL_HEIGHT
        }

        for (let i = 0; i < linesHelperRef.current.length; i++) {
            linesY[i] = virtualY
            virtualY += linesHelperRef.current[i].height
            if (activeInterlude && activeInterlude.lineIndex === i) {
                interludeY = virtualY
                virtualY += INTERLUDE_TOTAL_HEIGHT
            }
        }

        if (activeInterlude && interludeY !== null) {
            activeCenterY = interludeY + INTERLUDE_TOTAL_HEIGHT / 2
        } else if (linesHelperRef.current[targetIndex]) {
            activeCenterY = linesY[targetIndex] + linesHelperRef.current[targetIndex].height / 2
        }

        const ALIGN_OFFSET = alignPosition === 'top-second' ? 120 : playerHeight * ALIGN_POSITION
        const offsetToCenter = ALIGN_OFFSET - activeCenterY

        if (activeInterlude && interludeY !== null && interludeContainerRef.current) {
            const dotsY = interludeY + offsetToCenter + (INTERLUDE_TOTAL_HEIGHT - 40) / 2
            interludeContainerRef.current.style.transform = `translateY(${dotsY}px)`
        }

        const currentBlurStrength = usePlayerStore.getState().lyricBlurStrength

        linesHelperRef.current.forEach((l, i) => {
            const diff = activeInterlude ? (i <= activeInterlude.lineIndex ? i - activeInterlude.lineIndex - 1 : i - activeInterlude.lineIndex) : i - targetIndex
            const absDiff = Math.abs(diff)

            // 视口裁剪：远离中心的行直接隐藏，极大提升渲染速度
            if (absDiff > VIEWPORT_BUFFER) {
                if (l.el.style.display !== 'none') l.el.style.display = 'none';
                return;
            }
            if (l.el.style.display === 'none') l.el.style.display = 'block';

            const targetOpacity = diff === 0 ? 1.0 : (absDiff > 5 ? 0.0 : 0.5)
            const targetBlur = diff === 0 ? 0.0 : (absDiff === 1 ? currentBlurStrength * 0.3 : currentBlurStrength)
            const targetScale = diff === 0 ? 1.0 : 0.9
            const targetY = linesY[i] + offsetToCenter

            if (immediate) {
                l.el.style.transition = 'none'
            } else {
                l.el.style.transition = `transform ${LYRIC_TRANSITION}, opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1), filter 1000ms cubic-bezier(0.16, 1, 0.3, 1)`
            }

            l.el.style.transform = `translateY(${targetY.toFixed(1)}px) scale(${targetScale})`
            l.el.style.transformOrigin = 'left center'
            l.el.style.opacity = targetOpacity.toFixed(3)
            l.el.style.filter = targetBlur > 0 ? `blur(${targetBlur}px)` : 'none'
            l.el.style.setProperty('--lyric-color', diff === 0 ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.4)')
            l.el.style.setProperty('--trans-color', diff === 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)')
        })
    }

    const updateWordAnimations = (lineHelper: LyricLineHelper, loopTime: number) => {
        lineHelper.wordEls.forEach((w) => {
            if (w.animating) return
            const timeStart = w.data.startTime
            const delay = timeStart - loopTime
            const duration = w.data.duration
            if (delay < -duration - 1000) return

            if (lineHelper.data.isVerbatim) {
                const fadeWidth = w.height * WORD_FADE_WIDTH
                const wTotal = w.width + w.padding * 2 + fadeWidth
                const animDuration = Math.max(duration + 100, 300)

                w.maskAnim = w.span.animate([{ maskPosition: `${-wTotal}px 0` }, { maskPosition: `0px 0` }], {
                    delay: delay, duration: animDuration, fill: 'both', easing: 'linear'
                })

                w.floatAnim = w.span.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(-2px)' }], {
                    delay: Math.max(0, delay), duration: 1000, fill: 'both', easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)'
                })
            }

            if (!usePlayerStore.getState().isPlaying) {
                if (w.maskAnim) w.maskAnim.pause()
                if (w.floatAnim) w.floatAnim.pause()
            }
            w.animating = true
        })
    }

    const getActiveInterlude = useCallback((time: number) => {
        if (parsedLyrics.length === 0) return null
        const firstStart = parsedLyrics[0].startTime
        if (firstStart > 2000 && time < firstStart) return { start: 0, end: firstStart, lineIndex: -1 }
        for (let i = 0; i < parsedLyrics.length - 1; i++) {
            const nextStart = parsedLyrics[i + 1].startTime
            let interludeStart: number
            if (parsedLyrics[i].isVerbatim) {
                interludeStart = parsedLyrics[i].endTime
            } else {
                // For non-verbatim lyrics, estimate singing duration as 60% of gap or max 3s
                const lineDuration = nextStart - parsedLyrics[i].time
                const estimatedSingEnd = parsedLyrics[i].time + Math.min(lineDuration * 0.6, 3000)
                interludeStart = estimatedSingEnd
            }
            if (nextStart - interludeStart > 4000 && time >= interludeStart && time < nextStart) return { start: interludeStart, end: nextStart, lineIndex: i }
        }
        return null
    }, [parsedLyrics])

    const resetAnimations = (clearAll: boolean = false) => {
        linesHelperRef.current.forEach(l => l.wordEls.forEach(w => {
            if (clearAll || !w.maskAnim || w.maskAnim.playState !== 'running') {
                if (w.maskAnim) w.maskAnim.cancel()
                if (w.floatAnim) w.floatAnim.cancel()
                w.animating = false
            }
        }))
    }

    const loop = (_timestamp: number) => {
        const realTime = playerService.getCurrentTime()
        const loopTime = realTime * 1000 + INTRO_DELAY

        // 检测由于用户拖动进度条或切歌导致的时间跳变，重置所有逐字动画以避免状态错乱
        if (Math.abs(loopTime - lastLoopTimeRef.current) > 1000) {
            resetAnimations(true)
        }
        lastLoopTimeRef.current = loopTime

        const currentInterlude = getActiveInterlude(loopTime)

        let activeIndex = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (loopTime >= parsedLyrics[i].time) {
                const hasInterlude = currentInterlude !== null
                const isVerbatim = parsedLyrics[i].isVerbatim
                
                // 对于逐字歌词，严格按照 endTime 切换
                if (isVerbatim) {
                    if (loopTime >= parsedLyrics[i].endTime && i + 1 < parsedLyrics.length && !hasInterlude) {
                        activeIndex = i + 1;
                    } else {
                        activeIndex = i;
                    }
                } else {
                    // 对于普通歌词，根据下一句开始时间提前切换
                    // 提前量 = 当前句持续时间 * 0.7（在 70% 进度时切换到下一句）
                    const currentLineDuration = parsedLyrics[i].endTime - parsedLyrics[i].time
                    const advanceThreshold = parsedLyrics[i].time + currentLineDuration * 0.7
                    
                    if (i + 1 < parsedLyrics.length && !hasInterlude && loopTime >= advanceThreshold) {
                        activeIndex = i + 1;
                    } else {
                        activeIndex = i;
                    }
                }
            }
        }

        // 仅在歌词行切换或间奏状态变化时更新布局，不再节流每 100ms 打断 CSS transition
        const interludeChanged = currentInterlude?.start !== interludeRef.current?.start
        if (currentScrollIndexRef.current !== activeIndex || interludeChanged) {
            currentScrollIndexRef.current = activeIndex
            interludeRef.current = currentInterlude
            updateLayoutTargets(activeIndex, currentInterlude)
        }

        // 逐字动画仍然保持高频检查
        if (linesHelperRef.current[activeIndex]) updateWordAnimations(linesHelperRef.current[activeIndex], loopTime)

        // 通过 loopRef 调度下一帧，确保始终使用最新闭包
        requestRef.current = requestAnimationFrame((ts) => loopRef.current(ts))
    }

    // 用 ref 保存最新的 loop 引用，避免闭包陈旧问题
    const loopRef = useRef(loop)
    loopRef.current = loop

    useEffect(() => {
        requestRef.current = requestAnimationFrame((ts) => loopRef.current(ts))
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current) }
    }, [])

    useEffect(() => {
        linesHelperRef.current.forEach(l => {
            l.wordEls.forEach(w => {
                if (isPlaying) {
                    if (w.maskAnim?.playState === 'paused') w.maskAnim.play()
                    if (w.floatAnim?.playState === 'paused') w.floatAnim.play()
                } else {
                    if (w.maskAnim?.playState === 'running') w.maskAnim.pause()
                    if (w.floatAnim?.playState === 'running') w.floatAnim.pause()
                }
            })
        })
    }, [isPlaying])

    const handleLineClick = (lineTime: number) => {
        const timeInSeconds = (lineTime - INTRO_DELAY) / 1000
        playerService.seek(timeInSeconds)
        resetAnimations(true)
    }

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden relative select-none" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, white 15%, white 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, white 15%, white 80%, transparent 100%)' }}>
            <div className="lyric-content relative w-full h-full">
                {parsedLyrics.map((line, index) => (
                    <div
                        key={index}
                        onClick={() => handleLineClick(line.time)}
                        className="lyricLine absolute left-0 right-0 py-4 px-[6%] will-change-transform cursor-pointer hover:bg-white/5 rounded-2xl transition-colors duration-300"
                        style={{ transform: 'translateY(100vh)' }}
                    >
                        <div className="lyricMainLine flex flex-wrap">
                            {line.words.map((word, wIndex) => (
                                <span key={wIndex} className="lyricWord inline-block font-bold leading-tight whitespace-pre-wrap" style={{ paddingLeft: '0.1em', paddingRight: '0.1em', marginLeft: '-0.1em', marginRight: '-0.1em', fontFamily: lyricFontFamily, color: 'var(--lyric-color, rgba(255,255,255,0.4))', transition: 'var(--lyric-color-transition, color 800ms linear)', fontSize: `clamp(${lyricFontSize * 0.6}px, 2.8vw, ${lyricFontSize}px)`, willChange: 'mask-position, transform', transform: 'translateZ(0)' }}>
                                    {word.text}
                                </span>
                            ))}
                        </div>
                        {showTranslation && line.translation && (
                            <div className="lyricTranslation mt-1 font-medium leading-snug" style={{ fontFamily: lyricFontFamily, color: 'var(--trans-color, rgba(255,255,255,0.2))', transition: 'var(--lyric-color-transition, color 800ms linear)', fontSize: `clamp(${lyricFontSize * 0.35}px, 1.4vw, ${lyricFontSize * 0.55}px)` }}>
                                {line.translation}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={interludeContainerRef} style={{ position: 'absolute', left: '6%', top: 0, zIndex: 5, transition: `transform ${LYRIC_TRANSITION}` }}>
                    <InterludeDots interludeRef={interludeRef} />
                </div>
            </div>
        </div>
    )
})
