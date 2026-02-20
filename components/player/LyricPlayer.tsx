"use client"

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { Spring } from "@/lib/utils/spring"

interface WordData {
    text: string
    startTime: number
    endTime: number
    duration: number
}

interface LyricLineData {
    time: number
    endTime: number
    startTime: number
    words: WordData[]
    isVerbatim: boolean
    translation?: string
}

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
    }[]
    height: number
    springs: {
        posY: Spring
        scale: Spring
    }
}

const ALIGN_POSITION = 0.45
const WORD_FADE_WIDTH = 0.5
const POS_Y_SPRING_PARAMS = { mass: 0.9, damping: 15, stiffness: 90 }
const SCALE_SPRING_PARAMS = { mass: 2, damping: 25, stiffness: 100 }
const INTRO_DELAY = 4000

// Helper component for Interlude dots
function InterludeDots({ time, interlude }: { time: number, interlude: { start: number, end: number } | null }) {
    const dot0Ref = useRef<HTMLSpanElement>(null)
    const dot1Ref = useRef<HTMLSpanElement>(null)
    const dot2Ref = useRef<HTMLSpanElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const targetBreatheDuration = 1500

    useEffect(() => {
        if (!containerRef.current || !dot0Ref.current || !dot1Ref.current || !dot2Ref.current) return

        if (!interlude) {
            containerRef.current.style.transform = "scale(0)"
            containerRef.current.style.opacity = "0"
            return
        }

        const start = interlude.start
        const end = interlude.end
        const interludeDuration = end - start
        const currentDuration = time - start

        if (currentDuration <= interludeDuration && currentDuration >= 0) {
            const clamp = (min: number, cur: number, max: number) => Math.max(min, Math.min(cur, max))
            const easeOutExpo = (x: number) => x === 1 ? 1 : 1 - 2 ** (-10 * x)
            const easeInOutBack = (x: number) => {
                const c1 = 1.70158
                const c2 = c1 * 1.525
                return x < 0.5
                    ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
                    : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
            }

            const breatheDuration = interludeDuration / Math.ceil(interludeDuration / targetBreatheDuration)
            let scale = Math.sin(1.5 * Math.PI - (currentDuration / breatheDuration) * 2) / 20 + 1
            let globalOpacity = 1

            // Entry
            if (currentDuration < 2000) scale *= easeOutExpo(currentDuration / 2000)
            if (currentDuration < 500) globalOpacity = 0
            else if (currentDuration < 1000) globalOpacity *= (currentDuration - 500) / 500

            // Exit
            if (interludeDuration - currentDuration < 750) {
                scale *= 1 - easeInOutBack((750 - (interludeDuration - currentDuration)) / 750 / 2)
            }

            scale = Math.max(0, scale) * 0.7
            containerRef.current.style.transform = `scale(${scale})`
            containerRef.current.style.opacity = "1"

            const dotsDuration = Math.max(0, interludeDuration - 750)
            const dot0Opacity = clamp(0.25, ((currentDuration * 3) / dotsDuration) * 0.75, 1)
            const dot1Opacity = clamp(0.25, (((currentDuration - dotsDuration / 3) * 3) / dotsDuration) * 0.75, 1)
            const dot2Opacity = clamp(0.25, (((currentDuration - (dotsDuration / 3) * 2) * 3) / dotsDuration) * 0.75, 1)

            dot0Ref.current.style.opacity = String(Math.max(0, globalOpacity * dot0Opacity))
            dot1Ref.current.style.opacity = String(Math.max(0, globalOpacity * dot1Opacity))
            dot2Ref.current.style.opacity = String(Math.max(0, globalOpacity * dot2Opacity))
        } else {
            containerRef.current.style.transform = "scale(0)"
            containerRef.current.style.opacity = "0"
        }
    }, [time, interlude])

    return (
        <div
            ref={containerRef}
            className="interlude-dots absolute flex gap-4 transition-opacity duration-300"
            style={{ transform: 'scale(0)', opacity: 0 }}
        >
            <span ref={dot0Ref} className="w-2 h-2 rounded-full bg-white/60" />
            <span ref={dot1Ref} className="w-2 h-2 rounded-full bg-white/60" />
            <span ref={dot2Ref} className="w-2 h-2 rounded-full bg-white/60" />
        </div>
    )
}

export function LyricPlayer() {
    const { currentTrack, isPlaying, showTranslation } = usePlayerStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const linesHelperRef = useRef<LyricLineHelper[]>([])
    const currentScrollIndexRef = useRef(-1)
    const requestRef = useRef<number>()
    const lastFrameTimeRef = useRef<number>()

    const [parsedLyrics, setParsedLyrics] = useState<LyricLineData[]>([])
    const [interlude, setInterlude] = useState<{ start: number, end: number, lineIndex: number } | null>(null)
    const interludeDotsPosRef = useRef({ x: 0, y: 0 })

    // Parse lyrics
    useEffect(() => {
        const hasYrc = currentTrack?.yrc && currentTrack.yrc.trim().length > 0;
        const lyricSource = hasYrc ? currentTrack.yrc : (currentTrack?.lyric || "");
        console.log("[LyricPlayer] Init parsing", { hasYrc, yrcLength: currentTrack?.yrc?.length, hasLyric: !!currentTrack?.lyric });
        if (!lyricSource) {
            setParsedLyrics([])
            return
        }

        try {
            const rawLines = lyricSource.split('\n').filter(l => l.trim())
            console.log(`[LyricPlayer] Parsing ${rawLines.length} lines. First line:`, rawLines[0]);
            const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/
            const yrcLineRegex = /^\[(\d+),(\d+)\]/
            const yrcWordRegex = /\((\d+),(\d+),\d+\)([^(\[]+)/g

            const processed = rawLines.map((lineStr, i) => {
                let timeMs = 0
                let words: WordData[] = []
                let endTime = 0

                // 1. Try JSON format (Metadata/Credits)
                if (lineStr.startsWith('{')) {
                    try {
                        const json = JSON.parse(lineStr)
                        timeMs = json.t + INTRO_DELAY
                        words = json.c.map((segment: any) => ({
                            text: segment.tx,
                            startTime: timeMs,
                            endTime: timeMs + 1000,
                            duration: 1000
                        }))
                        return { time: timeMs, startTime: timeMs, endTime: timeMs + 1000, words, isVerbatim: false }
                    } catch (e) { return null }
                }

                // 2. Try YRC format (Verbatim)
                const yrcMatch = lineStr.match(yrcLineRegex)
                if (yrcMatch) {
                    const lineStart = parseInt(yrcMatch[1])
                    const lineDuration = parseInt(yrcMatch[2])
                    timeMs = lineStart + INTRO_DELAY
                    endTime = timeMs + lineDuration

                    let wordMatch
                    yrcWordRegex.lastIndex = 0
                    while ((wordMatch = yrcWordRegex.exec(lineStr)) !== null) {
                        const wStart = parseInt(wordMatch[1]) + INTRO_DELAY
                        const wDur = parseInt(wordMatch[2])
                        words.push({
                            text: wordMatch[3],
                            startTime: wStart,
                            endTime: wStart + wDur,
                            duration: wDur
                        })
                    }

                    if (words.length > 0) {
                        return { time: timeMs, startTime: timeMs, endTime, words, isVerbatim: true }
                    }
                }

                // 3. Try LRC format (Standard)
                const lrcMatch = lineStr.match(lrcRegex)
                if (lrcMatch) {
                    const mins = parseInt(lrcMatch[1])
                    const secs = parseInt(lrcMatch[2])
                    const ms = parseInt(lrcMatch[3].padEnd(3, '0').slice(0, 3))
                    timeMs = (mins * 60 + secs) * 1000 + ms + INTRO_DELAY
                    words = [{
                        text: lrcMatch[4].trim(),
                        startTime: timeMs,
                        endTime: timeMs + 2000,
                        duration: 2000
                    }]
                    return { time: timeMs, startTime: timeMs, endTime: timeMs + 2000, words, isVerbatim: false }
                }

                return null
            }).filter(l => l !== null) as LyricLineData[]

            // Refine timings for non-verbatim (LRC/JSON)
            processed.sort((a, b) => a.time - b.time)
            processed.forEach((line, i) => {
                const nextLine = processed[i + 1]
                const nextTime = nextLine ? nextLine.time : line.time + 3000

                // Only auto-distribute if it looks like standard LRC (single word)
                if (line.words.length === 1 && line.words[0].duration === 2000) {
                    const rawDuration = nextTime - line.time
                    let lineDuration = rawDuration
                    if (rawDuration > 4000) {
                        lineDuration = Math.max(2000, rawDuration - 2500)
                    }
                    line.endTime = line.time + lineDuration
                    line.words[0].endTime = line.endTime
                    line.words[0].duration = lineDuration
                }
            })

            console.log(`[LyricPlayer] Parse success. Verbatim lines: ${processed.filter(l => l.isVerbatim).length}/${processed.length}`);

            // 解析翻译歌词并按时间匹配
            const translationSource = hasYrc ? currentTrack?.ytlrc : currentTrack?.tlyric;
            if (translationSource && translationSource.trim().length > 0) {
                const tLines = translationSource.split('\n').filter(l => l.trim())
                const tLrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/
                const translationMap: { time: number, text: string }[] = []

                for (const tLine of tLines) {
                    const m = tLine.match(tLrcRegex)
                    if (m) {
                        const mins = parseInt(m[1])
                        const secs = parseInt(m[2])
                        const ms = parseInt(m[3].padEnd(3, '0').slice(0, 3))
                        const tMs = (mins * 60 + secs) * 1000 + ms + INTRO_DELAY
                        const text = m[4].trim()
                        if (text) translationMap.push({ time: tMs, text })
                    }
                }

                // 按时间匹配翻译到主歌词行（容差500ms）
                for (const lyricLine of processed) {
                    let bestMatch: { time: number, text: string } | null = null
                    let bestDiff = Infinity
                    for (const t of translationMap) {
                        const diff = Math.abs(t.time - lyricLine.time)
                        if (diff < bestDiff) {
                            bestDiff = diff
                            bestMatch = t
                        }
                    }
                    if (bestMatch && bestDiff < 500) {
                        lyricLine.translation = bestMatch.text
                    }
                }
                console.log(`[LyricPlayer] Translations matched: ${processed.filter(l => l.translation).length}/${processed.length}`);
            }

            setParsedLyrics(processed)
        } catch (error) {
            console.error("Lyric parsing error:", error)
            setParsedLyrics([])
        }
    }, [currentTrack?.lyric, currentTrack?.yrc, currentTrack?.tlyric, currentTrack?.ytlrc])

    // Measurements & Setup
    useEffect(() => {
        if (!containerRef.current || parsedLyrics.length === 0) return

        const playerEl = containerRef.current.querySelector('.lyric-content') as HTMLDivElement
        if (!playerEl) return

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

            const posY = new Spring(window.innerHeight * 0.5)
            const scale = new Spring(100)
            posY.updateParams(POS_Y_SPRING_PARAMS)
            scale.updateParams(SCALE_SPRING_PARAMS)

            const helper: LyricLineHelper = { el, index, data, wordEls, height: el.clientHeight || 60, springs: { posY, scale } }

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
                const maskImage = `linear-gradient(to right, rgba(255,255,255,1.0) ${leftPos * 100}%, rgba(255,255,255,0.4) ${(leftPos + (fadeWidth / Math.max(1, (w.width + w.padding * 2))) / totalAspect) * 100}%)`
                const totalAspectStr = `${totalAspect * 100}% 100%`
                w.span.style.maskImage = maskImage
                w.span.style.webkitMaskImage = maskImage
                w.span.style.maskSize = totalAspectStr
                w.span.style.webkitMaskSize = totalAspectStr
            })
            return helper
        }).filter(l => l !== null)
        updateLayoutTargets(0, null, true)
    }, [parsedLyrics])

    // 翻译行显示/隐藏时重新测量行高并更新布局
    useEffect(() => {
        if (linesHelperRef.current.length === 0) return
        // 等待 DOM 更新后重新测量
        requestAnimationFrame(() => {
            linesHelperRef.current.forEach(l => {
                if (l && l.el) l.height = l.el.clientHeight || 60
            })
            const idx = Math.max(0, currentScrollIndexRef.current)
            updateLayoutTargets(idx, null)
        })
    }, [showTranslation])

    const updateLayoutTargets = (targetIndex: number, activeInterlude: { lineIndex: number } | null, immediate = false) => {
        if (!containerRef.current || linesHelperRef.current.length === 0) return

        const playerHeight = containerRef.current.clientHeight
        let scrollOffset = 0
        const DOT_HEIGHT = 20
        const DOT_MARGIN = 30
        const INTERLUDE_TOTAL_HEIGHT = DOT_HEIGHT + (DOT_MARGIN * 2)

        if (activeInterlude && activeInterlude.lineIndex === -1) {
            scrollOffset += INTERLUDE_TOTAL_HEIGHT
        }

        for (let i = 0; i < targetIndex; i++) {
            scrollOffset += linesHelperRef.current[i].height
            if (activeInterlude && activeInterlude.lineIndex === i) {
                scrollOffset += INTERLUDE_TOTAL_HEIGHT
            }
        }

        let curPos = -scrollOffset + playerHeight * ALIGN_POSITION
        curPos -= linesHelperRef.current[targetIndex].height / 2

        if (activeInterlude && activeInterlude.lineIndex === -1) {
            const dotsY = curPos - DOT_MARGIN - DOT_HEIGHT
            interludeDotsPosRef.current = { x: 0, y: dotsY }
        }

        let delay = 0
        let baseDelay = immediate ? 0 : 0.05

        linesHelperRef.current.forEach((l, i) => {
            const isActive = i === targetIndex
            if (immediate) {
                l.springs.posY.setPosition(curPos)
                l.springs.scale.setPosition(100)
            } else {
                l.springs.posY.setTargetPosition(curPos, delay)
                l.springs.scale.setTargetPosition(100)
            }

            l.el.style.opacity = isActive ? "1" : "0.4"

            if (curPos >= 0 && !immediate) {
                delay += baseDelay
                if (i >= targetIndex) baseDelay /= 1.05
            }
            curPos += l.height

            if (activeInterlude && activeInterlude.lineIndex === i) {
                curPos += DOT_MARGIN
                interludeDotsPosRef.current = { x: 0, y: curPos }
                curPos += DOT_HEIGHT + DOT_MARGIN
            }
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

                // 由于 YRC 数据每个字自带 duration，可能因为停顿而和下个字之间存在空白 gap
                // 但为了在视觉上掩盖不平滑，我们需要在原唱 duration 的基础上加一点点尾随平滑时间，
                // 并且某些字的 duration 可能极度短暂，给 duration 增加 minimum 300ms 且带长尾阻尼保底
                const animDuration = Math.max(duration + 100, 300)

                w.maskAnim = w.span.animate([{ maskPosition: `${-wTotal}px 0` }, { maskPosition: `0px 0` }], {
                    delay: delay, duration: animDuration, fill: 'both', easing: 'linear'
                })
            }

            if (!usePlayerStore.getState().isPlaying) {
                if (w.maskAnim) w.maskAnim.pause()
            }

            w.animating = true
        })
    }

    const getActiveInterlude = useCallback((time: number) => {
        if (parsedLyrics.length === 0) return null
        const firstStart = parsedLyrics[0].startTime
        if (firstStart > 2000 && time < firstStart) return { start: 0, end: firstStart, lineIndex: -1 }
        for (let i = 0; i < parsedLyrics.length - 1; i++) {
            const end = parsedLyrics[i].endTime
            const nextStart = parsedLyrics[i + 1].startTime
            if (nextStart - end > 4000 && time >= end && time <= nextStart) return { start: end, end: nextStart, lineIndex: i }
        }
        return null
    }, [parsedLyrics])

    const resetAnimations = (clearAll: boolean = false) => {
        linesHelperRef.current.forEach(l => l.wordEls.forEach(w => {
            if (clearAll || !w.maskAnim || w.maskAnim.playState !== 'running') {
                if (w.maskAnim) w.maskAnim.cancel()
                w.animating = false
            }
        }))
    }

    // Animation Loop — 使用 playerService.getCurrentTime() 实时读取播放位置
    const loop = (timestamp: number) => {
        if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp
        const dt = (timestamp - lastFrameTimeRef.current) / 1000
        lastFrameTimeRef.current = timestamp

        const realTime = playerService.getCurrentTime()
        const loopTime = realTime * 1000 + INTRO_DELAY

        let activeIndex = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (loopTime >= parsedLyrics[i].time) activeIndex = i
        }

        const currentInterlude = getActiveInterlude(loopTime)
        if (currentScrollIndexRef.current !== activeIndex || currentInterlude?.start !== interlude?.start) {
            currentScrollIndexRef.current = activeIndex
            setInterlude(currentInterlude)
            updateLayoutTargets(activeIndex, currentInterlude)
        }

        if (linesHelperRef.current[activeIndex]) updateWordAnimations(linesHelperRef.current[activeIndex], loopTime)

        if (dt > 0 && dt < 0.1) {
            linesHelperRef.current.forEach(l => {
                if (l && l.springs) {
                    l.springs.posY.update(dt)
                    l.springs.scale.update(dt)
                    const y = l.springs.posY.getCurrentPosition()
                    const s = l.springs.scale.getCurrentPosition() / 100
                    l.el.style.transform = `translateY(${y.toFixed(1)}px) scale(${s.toFixed(4)})`
                }
            })
        }
        requestRef.current = requestAnimationFrame(loop)
    }

    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop)
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current) }
    }, [parsedLyrics])

    useEffect(() => {
        linesHelperRef.current.forEach(l => {
            l.wordEls.forEach(w => {
                if (isPlaying) {
                    if (w.maskAnim?.playState === 'paused') w.maskAnim.play()
                } else {
                    if (w.maskAnim?.playState === 'running') w.maskAnim.pause()
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
        <div ref={containerRef} className="w-full h-full overflow-hidden relative" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, white 15%, white 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, white 15%, white 80%, transparent 100%)' }}>
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
                                <span key={wIndex} className="lyricWord inline-block text-[clamp(19px,2.8vw,34px)] font-bold leading-tight text-white/90 whitespace-pre-wrap" style={{ paddingLeft: '0.1em', paddingRight: '0.1em', marginLeft: '-0.1em', marginRight: '-0.1em', fontFamily: 'MiSans, sans-serif' }}>
                                    {word.text}
                                </span>
                            ))}
                        </div>
                        {showTranslation && line.translation && (
                            <div className="lyricTranslation mt-1 text-[clamp(11px,1.4vw,18px)] font-medium text-white/50 leading-snug" style={{ fontFamily: 'MiSans, sans-serif' }}>
                                {line.translation}
                            </div>
                        )}
                    </div>
                ))}
                <div style={{ transform: `translate(${interludeDotsPosRef.current.x}px, ${interludeDotsPosRef.current.y}px)`, position: 'absolute', left: '6%', top: 0, zIndex: 5 }}>
                    <InterludeDots time={playerService.getCurrentTime() * 1000 + INTRO_DELAY} interlude={interlude} />
                </div>
            </div>
        </div>
    )
}
