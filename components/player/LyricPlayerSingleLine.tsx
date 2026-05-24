"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { usePlayerStore, SingleLineAnimation } from "@/lib/store/usePlayerStore"
import { playerService } from "@/lib/services/playerService"
import { LyricLineData, INTRO_DELAY, parseLyrics } from "./parser"

export const LyricPlayerSingleLine = React.memo(function LyricPlayerSingleLine() {
    const currentTrack = usePlayerStore(s => s.currentTrack)
    const showTranslation = usePlayerStore(s => s.showTranslation)
    const lyricFontSize = usePlayerStore(s => s.lyricFontSize)
    const singleLineAnimation = usePlayerStore(s => s.singleLineAnimation)
    const requestRef = useRef<number>(0)
    const currentIndexRef = useRef(-1)
    
    const [parsedLyrics, setParsedLyrics] = useState<LyricLineData[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    
    useEffect(() => {
        setParsedLyrics(parseLyrics(currentTrack))
    }, [currentTrack?.lyric, currentTrack?.yrc, currentTrack?.tlyric, currentTrack?.ytlrc])

    const getActiveIndex = useCallback((time: number) => {
        let idx = 0
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (time >= parsedLyrics[i].time) {
                idx = i
            }
        }
        return idx
    }, [parsedLyrics])

    useEffect(() => {
        let frameCount = 0
        const FRAME_SKIP = /Mobi|Android/i.test(navigator.userAgent) ? 3 : 1

        const loop = () => {
            frameCount++
            if (frameCount % FRAME_SKIP === 0) {
                const realTime = playerService.getCurrentTime()
                const loopTime = realTime * 1000 + INTRO_DELAY
                const newIndex = getActiveIndex(loopTime)
                if (newIndex !== currentIndexRef.current) {
                    currentIndexRef.current = newIndex
                    setActiveIndex(newIndex)
                }
            }
            requestRef.current = requestAnimationFrame(loop)
        }
        requestRef.current = requestAnimationFrame(loop)
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current) }
    }, [getActiveIndex])

    const handleLineClick = (lineTime: number) => {
        const timeInSeconds = (lineTime - INTRO_DELAY) / 1000
        playerService.seek(timeInSeconds)
    }

    if (parsedLyrics.length === 0) return null

    return (
        <div className="w-full h-full relative select-none flex items-center justify-center px-4 overflow-hidden">
            {parsedLyrics.map((line, index) => {
                const isActive = index === activeIndex
                const diff = index - activeIndex
                
                if (Math.abs(diff) > 2) return null

                let transform = ""
                let opacity = isActive ? 1 : 0
                let filter = "none"

                switch (singleLineAnimation) {
                    case SingleLineAnimation.Fade:
                        transform = `scale(${isActive ? 1 : 0.95})`
                        break
                    case SingleLineAnimation.Zoom:
                        transform = `scale(${isActive ? 1 : (diff < 0 ? 1.2 : 0.8)})`
                        break
                    case SingleLineAnimation.Blur:
                        transform = `scale(${isActive ? 1 : 0.95})`
                        filter = isActive ? 'blur(0px)' : 'blur(16px)'
                        break
                    case SingleLineAnimation.SlideUp:
                    default:
                        let translateY = 0
                        if (diff < 0) translateY = -150
                        if (diff > 0) translateY = 150
                        transform = `translateY(${translateY}%) scale(${isActive ? 1 : 0.95})`
                        break
                }

                return (
                    <div
                        key={index}
                        onClick={() => handleLineClick(line.time)}
                        className="absolute left-0 right-0 py-4 px-[6%] cursor-pointer hover:bg-white/5 rounded-2xl transition-all duration-[1000ms] flex flex-col items-center text-center justify-center"
                        style={{
                            transform,
                            opacity,
                            filter,
                            pointerEvents: isActive ? 'auto' : 'none',
                            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)"
                        }}
                    >
                        <div className="flex flex-wrap justify-center w-full">
                            <span 
                                className="inline-block font-bold leading-tight whitespace-pre-wrap text-white" 
                                style={{ 
                                    fontFamily: 'MiSans, sans-serif', 
                                    fontSize: `clamp(${lyricFontSize * 0.8}px, 4vw, ${lyricFontSize * 1.5}px)`,
                                    textShadow: "0 4px 16px rgba(0,0,0,0.3)"
                                }}
                            >
                                {line.words.map(w => w.text).join('')}
                            </span>
                        </div>
                        {showTranslation && line.translation && (
                            <div 
                                className="mt-3 font-medium leading-snug text-white/70" 
                                style={{ 
                                    fontFamily: 'MiSans, sans-serif', 
                                    fontSize: `clamp(${lyricFontSize * 0.4}px, 2vw, ${lyricFontSize * 0.75}px)`,
                                    textShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                }}
                            >
                                {line.translation}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
})
