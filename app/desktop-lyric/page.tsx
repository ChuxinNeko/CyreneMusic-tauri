"use client"

import React, { useEffect, useState, useRef } from "react"
import { Play, Pause, SkipForward, SkipBack, X, MoveHorizontal, Lock, Unlock } from "lucide-react"
import { listen, emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Track } from "@/lib/models/track"
import { parseLyrics, LyricLineData, WordData, INTRO_DELAY } from "@/components/player/parser"

export default function DesktopLyricPage() {
    const rootRef = useRef<HTMLDivElement>(null)
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [parsedLyrics, setParsedLyrics] = useState<LyricLineData[]>([])
    const [isPlaying, setIsPlaying] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [renderTick, setRenderTick] = useState(0) // 强制触发渲染的 tick

    // Styling states
    const [lyricFontSize, setLyricFontSize] = useState(40)
    const [lyricColor, setLyricColor] = useState('#ffffff')
    const [lyricStrokeColor, setLyricStrokeColor] = useState('#bababa')

    // time-sync refs
    const lastSyncRef = useRef<{ time: number, timestamp: number }>({ time: 0, timestamp: Date.now() })

    // Elements refs
    const wordsRef = useRef<Map<number, HTMLSpanElement>>(new Map())
    const wordAnimsRef = useRef<Map<number, Animation>>(new Map())
    const requestRef = useRef<number>(0)
    const activeLineRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Force the desktop lyric window and all route wrappers to stay transparent.
        const html = document.documentElement
        const body = document.body
        const previousHtmlBackground = html.style.background
        const previousHtmlBackgroundColor = html.style.backgroundColor
        const previousBodyBackground = body.style.background
        const previousBodyBackgroundColor = body.style.backgroundColor
        const previousBodyOverflow = body.style.overflow
        const previousBodyUserSelect = body.style.userSelect

        html.style.background = "transparent"
        html.style.backgroundColor = "transparent"
        body.style.background = "transparent"
        body.style.backgroundColor = "transparent"
        body.style.overflow = "hidden"
        body.style.userSelect = "none"

        const patchedParents: Array<{
            element: HTMLElement
            background: string
            backgroundColor: string
        }> = []

        let parent = rootRef.current?.parentElement ?? null
        while (parent && parent !== body) {
            patchedParents.push({
                element: parent,
                background: parent.style.background,
                backgroundColor: parent.style.backgroundColor,
            })
            parent.style.background = "transparent"
            parent.style.backgroundColor = "transparent"
            parent = parent.parentElement
        }

        // Listen for current track changes
        const unlistenState = listen('player:state-change', (event: any) => {
            const payload = event.payload
            setCurrentTrack(payload.currentTrack)
            setIsPlaying(payload.isPlaying)
        })

        // Listen for fast time ticks
        const unlistenTime = listen<{ time: number, timestamp: number, isPlaying: boolean }>('player:time-sync', (event) => {
            lastSyncRef.current = {
                time: event.payload.time,
                timestamp: event.payload.timestamp
            }
            setIsPlaying(event.payload.isPlaying)
        })

        // Listen for custom styling values
        const unlistenSettings = listen<{ desktopLyricFontSize: number, desktopLyricColor: string, desktopLyricStrokeColor: string }>('player:settings-sync', (event) => {
            setLyricFontSize(event.payload.desktopLyricFontSize)
            setLyricColor(event.payload.desktopLyricColor)
            setLyricStrokeColor(event.payload.desktopLyricStrokeColor)
        })

        // On first load, manually fetch store state (in case we booted up after)
        // Wait, store might be empty if this window is independent, but tauri store is synced manually or via event?
        // Actually usePlayerStore uses zustand which is restricted to the current javascript context.
        // We will only get the state when the main window emits. But let's trigger an update request.
        emit('player:command', 'request-sync')

        return () => {
            html.style.background = previousHtmlBackground
            html.style.backgroundColor = previousHtmlBackgroundColor
            body.style.background = previousBodyBackground
            body.style.backgroundColor = previousBodyBackgroundColor
            body.style.overflow = previousBodyOverflow
            body.style.userSelect = previousBodyUserSelect
            patchedParents.forEach(({ element, background, backgroundColor }) => {
                element.style.background = background
                element.style.backgroundColor = backgroundColor
            })
            unlistenState.then(f => f())
            unlistenTime.then(f => f())
            unlistenSettings.then(f => f())
        }
    }, [])

    useEffect(() => {
        if (!currentTrack) {
            // Check if there is already a track in localStorage or state to fallback?
            // Since this window is fresh, currentTrack is null until the main window sends it.
            return
        }
        setParsedLyrics(parseLyrics(currentTrack))
    }, [currentTrack])

    const getCurrentRealTime = () => {
        const { time, timestamp } = lastSyncRef.current
        if (!isPlaying) return time * 1000 + INTRO_DELAY
        return (time + (Date.now() - timestamp) / 1000) * 1000 + INTRO_DELAY
    }

    // Animation Loop
    const loop = () => {
        const loopTime = getCurrentRealTime()
        let activeLineIndex = 0

        for (let i = 0; i < parsedLyrics.length; i++) {
            if (loopTime >= parsedLyrics[i].time) {
                if (loopTime >= parsedLyrics[i].endTime && i + 1 < parsedLyrics.length) {
                    activeLineIndex = i + 1;
                } else {
                    activeLineIndex = i;
                }
            }
        }

        // Apply word-by-word mask animations for the active line
        const activeLine = parsedLyrics[activeLineIndex]
        if (activeLine && activeLine.isVerbatim) {
            activeLine.words.forEach((word, wIndex) => {
                const globalWordIndex = activeLineIndex * 1000 + wIndex // simple specific id
                const span = wordsRef.current.get(globalWordIndex)
                if (!span) return

                const delay = word.startTime - loopTime
                if (delay < -word.duration - 500) return // already finished fully

                let anim = wordAnimsRef.current.get(globalWordIndex)
                if (!anim) {
                    const width = span.clientWidth
                    const wTotal = width + 30 // padding and fade width smooth

                    // define gradient
                    const maskImage = `linear-gradient(to right, 
                        rgba(255,255,255,1.0) 0%, 
                        rgba(255,255,255,1.0) 40%, 
                        rgba(255,255,255,0.4) 60%, 
                        rgba(255,255,255,0.4) 100%)`

                    span.style.maskImage = maskImage
                    span.style.webkitMaskImage = maskImage
                    span.style.maskSize = `${250}% 100%`
                    span.style.webkitMaskSize = `${250}% 100%`

                    anim = span.animate(
                        [{ maskPosition: `${-wTotal * 1.5}px 0` }, { maskPosition: `0px 0` }],
                        { delay: Math.max(0, delay), duration: Math.max(word.duration + 50, 300), fill: 'both', easing: 'linear' }
                    )
                    wordAnimsRef.current.set(globalWordIndex, anim)
                }

                if (isPlaying && anim.playState === 'paused') anim.play()
                if (!isPlaying && anim.playState === 'running') anim.pause()

                // Auto scroll logic for overflowing texts
                // If a word is currently being sung (delay <= 0 and anim not finished), we scroll to it
                if (delay <= 0 && delay > -word.duration) {
                    if (activeLineRef.current) {
                        const containerWidth = activeLineRef.current.clientWidth
                        const spanLeft = span.offsetLeft
                        const spanWidth = span.clientWidth
                        // Target scroll position: Center the span in the container
                        const targetScroll = spanLeft - (containerWidth / 2) + (spanWidth / 2)
                        activeLineRef.current.scrollTo({
                            left: Math.max(0, targetScroll),
                            behavior: 'smooth'
                        })
                    }
                }
            })
        }

        // 仅在当前组件是桌面歌词，并且由于失去焦点导致 react 渲染冻结时，我们通过 setState 强行激活 React 树
        setRenderTick(prev => prev + 1)
    }

    useEffect(() => {
        // Set target frame rate (e.g. 60 FPS = 16.6ms) for smooth animation even in background
        const intervalId = setInterval(loop, 1000 / 60)
        requestRef.current = intervalId as any

        // Initial call
        loop()

        return () => { clearInterval(intervalId) }
    }, [parsedLyrics, isPlaying])

    const sendCommand = (cmd: string) => emit('player:command', cmd)
    const closeWindow = () => getCurrentWindow().close()

    // Determine lines to show (Active)
    const getVisibleLines = () => {
        if (!parsedLyrics.length) return { currentLine: null }
        const loopTime = getCurrentRealTime()
        let activeIndex = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (loopTime >= parsedLyrics[i].time) {
                activeIndex = loopTime >= parsedLyrics[i].endTime && i + 1 < parsedLyrics.length ? i + 1 : i;
            }
        }
        return {
            currentLine: parsedLyrics[activeIndex] || null,
            activeIndex
        }
    }

    const { currentLine, activeIndex } = getVisibleLines()
    const mainLineHeight = Math.max(lyricFontSize * 1.35, lyricFontSize + 18)
    const translationFontSize = Math.max(14, lyricFontSize * 0.55)
    const translationLineHeight = Math.max(translationFontSize * 1.35, translationFontSize + 10)

    return (
        <div
            ref={rootRef}
            className="w-full h-full relative bg-transparent"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <style global jsx>{`
                html, body {
                    background: transparent !important;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none; /* IE and Edge */
                    scrollbar-width: none; /* Firefox */
                }
            `}</style>

            {/* Background Drag Region */}
            <div data-tauri-drag-region className="absolute inset-0 z-0 cursor-move" />

            <div className={`absolute inset-0 z-10 p-4 transition-opacity duration-300 pointer-events-none flex flex-col justify-center`}>
                {/* 歌词区 */}
                {currentLine ? (
                    <div className="flex flex-col gap-2 w-full py-2 text-center drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] overflow-visible">
                        <div
                            ref={activeLineRef}
                            className="lyric-line-active font-bold tracking-wide transition-all duration-300 overflow-x-auto overflow-y-visible whitespace-nowrap scroll-smooth no-scrollbar"
                            style={{
                                fontSize: `${lyricFontSize}px`,
                                lineHeight: `${mainLineHeight}px`,
                                padding: "0.18em 0 0.28em",
                                color: lyricColor,
                                WebkitTextStroke: `1px ${lyricStrokeColor}`
                            }}
                        >
                            {currentLine.words.map((w, i) => {
                                return (
                                    <span
                                        key={i}
                                        className="inline-block mx-0.5"
                                        ref={el => { if (el) wordsRef.current.set(activeIndex! * 1000 + i, el) }}
                                        style={{
                                            textShadow: `0 2px 4px ${lyricStrokeColor}80`,
                                            paddingBottom: "0.08em",
                                            verticalAlign: "baseline"
                                        }}
                                    >
                                        {w.text}
                                    </span>
                                )
                            })}
                        </div>
                        {currentLine.translation && (
                            <div
                                className="lyric-line-translation font-medium transition-all duration-300 drop-shadow-md overflow-x-auto overflow-y-visible whitespace-nowrap scroll-smooth no-scrollbar"
                                style={{
                                    fontSize: `${translationFontSize}px`,
                                    lineHeight: `${translationLineHeight}px`,
                                    padding: "0.1em 0 0.2em",
                                    color: lyricColor,
                                    opacity: 0.8,
                                    WebkitTextStroke: `1px ${lyricStrokeColor}`
                                }}
                            >
                                {currentLine.translation}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-xl font-medium text-white/50 text-center drop-shadow-md">Cyrene Music</div>
                )}
            </div>

            {/* 控制栏 (悬浮时显示) */}
            <div className={`absolute inset-0 z-20 bg-black/40 rounded-xl flex items-center justify-between px-6 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'} pointer-events-auto`}>
                <div data-tauri-drag-region className="absolute inset-0 cursor-move z-0" />

                <div className="flex items-center gap-3 z-10">
                    <button className="text-white/80 hover:text-white transition" onClick={() => sendCommand('prev')}><SkipBack size={20} /></button>
                    <button className="text-white hover:scale-110 transition" onClick={() => sendCommand('toggle-play')}>
                        {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current" />}
                    </button>
                    <button className="text-white/80 hover:text-white transition" onClick={() => sendCommand('next')}><SkipForward size={20} /></button>
                </div>

                <div className="flex items-center gap-4 z-10">
                    <button className="text-red-400 hover:text-red-300 transition" onClick={closeWindow} title="关闭 (Close)">
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    )
}
