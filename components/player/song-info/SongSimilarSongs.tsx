"use client"

import React, { useEffect, useState } from "react"
import { Track } from "@/lib/models/track"
import { neteaseSongWikiService } from "@/lib/services/neteaseSongWikiService"
import { PlayCircle } from "lucide-react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"

interface SongSimilarSongsProps {
    track: Track | null
}

interface SimilarSong {
    id: string
    name: string
    artist: string
    imageUrl: string
}

export function SongSimilarSongs({ track }: SongSimilarSongsProps) {
    const [similarSongs, setSimilarSongs] = useState<SimilarSong[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const { setCurrentTrack, setIsPlaying } = usePlayerStore()

    useEffect(() => {
        const fetchSimilarSongs = async () => {
            if (!track || track.source !== 'netease') {
                setSimilarSongs([])
                return
            }

            setIsLoading(true)
            try {
                const wikiData = await neteaseSongWikiService.fetchSongWiki(track.id)
                if (wikiData && wikiData.blocks) {
                    const similarBlock = wikiData.blocks.find(b => b.code === 'SONG_PLAY_ABOUT_SIMILAR_SONG')
                    const creatives = similarBlock?.creatives || []

                    const songs: SimilarSong[] = []

                    for (const creative of creatives) {
                        for (const res of creative.resources || []) {
                            const anyRes = res as any
                            if (anyRes.resourceType !== 'SONG') continue

                            const uiElement = anyRes.uiElement
                            if (!uiElement) continue

                            const title = uiElement.mainTitle?.title || ''

                            let artist = ''
                            const subTitles = uiElement.subTitles || []
                            if (subTitles.length > 0 && subTitles[0]) {
                                artist = subTitles[0].title || ''
                            }

                            let imageUrl = ''
                            const images = uiElement.images || []
                            if (images.length > 0 && images[0]) {
                                imageUrl = (images[0].imageUrl || '').replace('http://', 'https://')
                            }

                            const songId = anyRes.resourceId || ''

                            if (title) {
                                songs.push({
                                    id: songId,
                                    name: title,
                                    artist: artist,
                                    imageUrl: imageUrl
                                })
                            }
                        }
                    }

                    // 取前 6 首
                    setSimilarSongs(songs.slice(0, 6))
                } else {
                    setSimilarSongs([])
                }
            } catch (err) {
                console.error("Failed to parse similar songs", err)
                setSimilarSongs([])
            } finally {
                setIsLoading(false)
            }
        }

        fetchSimilarSongs()
    }, [track])

    const handlePlaySong = (song: SimilarSong) => {
        // 创建一个简单的 Track 对象并播放
        const newTrack: Track = {
            id: Number(song.id),
            name: song.name,
            artists: song.artist,
            album: "", // 简配
            picUrl: song.imageUrl,
            source: 'netease' as any,
            duration: 0
        }
        setCurrentTrack(newTrack)
        setIsPlaying(true)
    }

    if (isLoading) {
        return (
            <div className="w-full max-w-xl mx-auto p-4 flex justify-center mt-4 mb-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50"></div>
            </div>
        )
    }

    if (similarSongs.length === 0) return null

    return (
        <div className="w-full max-w-xl mx-auto mb-8">
            <h4 className="text-[16px] font-semibold text-white mb-4 px-2">
                相似歌曲
            </h4>
            <div className="space-y-2">
                {similarSongs.map((song, index) => (
                    <div
                        key={`${song.id}-${index}`}
                        onClick={() => handlePlaySong(song)}
                        className="group flex items-center gap-3 p-2 rounded-[8px] hover:bg-white/10 cursor-pointer transition-colors"
                    >
                        <div className="w-12 h-12 rounded-[6px] overflow-hidden shrink-0 relative bg-white/5">
                            {song.imageUrl ? (
                                <img src={song.imageUrl} alt={song.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-white/20 text-xs">暂无</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className="text-[14px] font-semibold text-white truncate leading-tight mb-1">
                                {song.name}
                            </p>
                            <p className="text-[12px] text-white/50 truncate leading-tight">
                                {song.artist}
                            </p>
                        </div>
                        <div className="pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle size={16} className="text-white/50 hover:text-white transition-colors" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
