"use client"

import React, { useEffect, useState } from "react"
import { Track } from "@/lib/models/track"
import { neteaseSongWikiService, SongWikiSummary } from "@/lib/services/neteaseSongWikiService"

interface SongWikiProps {
    track: Track | null
}

interface ParsedWikiData {
    styles: string[]
    language: string
    bpm: string
}

export function SongWiki({ track }: SongWikiProps) {
    const [wikiData, setWikiData] = useState<ParsedWikiData | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const fetchWiki = async () => {
            // 只在网易云音源时才去请求百科
            if (!track || track.source !== 'netease') {
                setWikiData(null)
                return
            }

            setIsLoading(true)
            try {
                const data = await neteaseSongWikiService.fetchSongWiki(track.id)
                if (data) {
                    const parsed = parseWikiData(data)
                    // If everything is empty we don't need to show it
                    if (parsed.styles.length > 0 || parsed.language || parsed.bpm) {
                        setWikiData(parsed)
                    } else {
                        setWikiData(null)
                    }
                } else {
                    setWikiData(null)
                }
            } catch (err) {
                console.error("Failed to parse wiki data", err)
                setWikiData(null)
            } finally {
                setIsLoading(false)
            }
        }
        fetchWiki()
    }, [track])

    const parseWikiData = (data: SongWikiSummary): ParsedWikiData => {
        const basicBlock = data.blocks?.find(b => b.code === 'SONG_PLAY_ABOUT_SONG_BASIC')
        const creatives = basicBlock?.creatives || []

        const styles: string[] = []
        let language = ''
        let bpm = ''

        for (const creative of creatives) {
            const cType = creative.creativeType
            const uiElement = creative.uiElement

            if (cType === 'songTag') {
                const resources = creative.resources || []
                for (const res of resources) {
                    const title = res.uiElement?.mainTitle?.title
                    if (title) styles.push(title)
                }
            } else if (cType === 'language') {
                const textLinks = uiElement?.textLinks || []
                if (textLinks.length > 0) {
                    language = textLinks[0].text
                }
            } else if (cType === 'bpm') {
                const textLinks = uiElement?.textLinks || []
                if (textLinks.length > 0) {
                    bpm = textLinks[0].text
                }
            }
        }

        return { styles, language, bpm }
    }

    if (isLoading) {
        return (
            <div className="w-full max-w-xl mx-auto p-4 flex justify-center mt-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50"></div>
            </div>
        )
    }

    if (!wikiData) return null

    return (
        <div className="w-full max-w-xl mx-auto p-4 mb-4 rounded-[12px] bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
            <h3 className="text-[16px] font-semibold text-white mb-4 px-2">
                音乐百科
            </h3>
            <div className="flex flex-wrap gap-x-8 gap-y-4 px-2">
                {wikiData.styles.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-white/50">曲风</span>
                        <span className="text-[14px] font-medium text-white">{wikiData.styles.join(" / ")}</span>
                    </div>
                )}
                {wikiData.language && (
                    <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-white/50">语种</span>
                        <span className="text-[14px] font-medium text-white">{wikiData.language}</span>
                    </div>
                )}
                {wikiData.bpm && (
                    <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-white/50">BPM</span>
                        <span className="text-[14px] font-medium text-white">{wikiData.bpm}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
