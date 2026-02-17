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
        floatAnim?: Animation
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
    const { currentTime, currentTrack, isPlaying } = usePlayerStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const linesHelperRef = useRef<LyricLineHelper[]>([])
    const lastLayoutTimeRef = useRef(0)
    const currentScrollIndexRef = useRef(-1)
    const requestRef = useRef<number>()
    const lastFrameTimeRef = useRef<number>()

    const [parsedLyrics, setParsedLyrics] = useState<LyricLineData[]>([])
    const [interlude, setInterlude] = useState<{ start: number, end: number, lineIndex: number } | null>(null)
    const interludeDotsPosRef = useRef({ x: 0, y: 0 })

    // Parse lyrics
    useEffect(() => {
        const lyricSource = (currentTrack?.yrc && currentTrack.yrc.trim()) ? currentTrack.yrc : (currentTrack?.lyric || "");
        if (!lyricSource) {
            setParsedLyrics([])
            return
        }

        try {
            const rawLines = lyricSource.split('\n').filter(l => l.trim())
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
                        return { time: timeMs, startTime: timeMs, endTime: timeMs + 1000, words }
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
                        return { time: timeMs, startTime: timeMs, endTime, words }
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
                    return { time: timeMs, startTime: timeMs, endTime: timeMs + 2000, words }
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

            setParsedLyrics(processed)
        } catch (error) {
            console.error("Lyric parsing error:", error)
            setParsedLyrics([])
        }
    }, [currentTrack?.lyric, currentTrack?.yrc])

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
                l.springs.scale.setPosition(isActive ? 100 : 97)
            } else {
                l.springs.posY.setTargetPosition(curPos, delay)
                l.springs.scale.setTargetPosition(isActive ? 100 : 97)
            }

            let blur = isActive ? 0 : 1 + Math.abs(targetIndex - i)
            l.el.style.filter = `blur(${Math.min(8, blur)}px)`
            l.el.style.opacity = isActive ? "1" : "0.5"

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

            w.floatAnim = w.span.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-0.05em)' }], {
                delay: delay, duration: Math.max(1000, duration), fill: 'both', easing: 'ease-out', composite: 'add'
            })
            const fadeWidth = w.height * WORD_FADE_WIDTH
            const wTotal = w.width + w.padding * 2 + fadeWidth
            w.maskAnim = w.span.animate([{ maskPosition: `${-wTotal}px 0` }, { maskPosition: `0px 0` }], {
                delay: delay, duration: duration, fill: 'both', easing: 'linear'
            })
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

    const resetAnimations = () => {
        linesHelperRef.current.forEach(l => l.wordEls.forEach(w => {
            if (w.floatAnim) w.floatAnim.cancel()
            if (w.maskAnim) w.maskAnim.cancel()
            w.animating = false
        }))
    }

    // Animation Loop
    const loop = (timestamp: number) => {
        if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp
        const dt = (timestamp - lastFrameTimeRef.current) / 1000
        lastFrameTimeRef.current = timestamp

        const loopTime = currentTime * 1000 + INTRO_DELAY
        let activeIndex = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (loopTime >= parsedLyrics[i].time) activeIndex = i
        }

        const currentInterlude = getActiveInterlude(loopTime)
        if (currentScrollIndexRef.current !== activeIndex || currentInterlude?.start !== interlude?.start || Math.abs(loopTime - lastLayoutTimeRef.current) > 500) {
            currentScrollIndexRef.current = activeIndex
            setInterlude(currentInterlude)
            updateLayoutTargets(activeIndex, currentInterlude)
            lastLayoutTimeRef.current = loopTime
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
    }, [currentTime, parsedLyrics, interlude])

    const handleLineClick = (lineTime: number) => {
        const timeInSeconds = (lineTime - INTRO_DELAY) / 1000
        playerService.seek(timeInSeconds)
        resetAnimations()
    }

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden relative">
            <div className="lyric-content relative w-full h-full">
                {parsedLyrics.map((line, index) => (
                    <div
                        key={index}
                        onClick={() => handleLineClick(line.time)}
                        className="lyricLine absolute left-0 right-0 py-4 px-[6%] will-change-transform cursor-pointer hover:bg-white/5 rounded-2xl transition-colors duration-300"
                        style={{ transform: 'translateY(100vh)' }}
                    >
                        <div className="lyricMainLine flex flex-wrap gap-x-[0.3em]">
                            {line.words.map((word, wIndex) => (
                                <span key={wIndex} className="lyricWord inline-block text-[clamp(24px,3.5vw,42px)] font-bold leading-tight text-white/90" style={{ paddingLeft: '0.1em', paddingRight: '0.1em' }}>
                                    {word.text}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
                <div style={{ transform: `translate(${interludeDotsPosRef.current.x}px, ${interludeDotsPosRef.current.y}px)`, position: 'absolute', left: '6%', top: 0, zIndex: 5 }}>
                    <InterludeDots time={currentTime * 1000 + INTRO_DELAY} interlude={interlude} />
                </div>
            </div>
        </div>
    )
}
