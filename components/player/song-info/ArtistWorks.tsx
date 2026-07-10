"use client"

import React, { useEffect, useState } from "react"
import { Track } from "@/lib/models/track"
import { artistService, ArtistDetailInfo } from "@/lib/services/artistService"
import { playerService } from "@/lib/services/playerService"
import { PlayCircle } from "lucide-react"

interface ArtistWorksProps {
    track: Track | null
}

export function ArtistWorks({ track }: ArtistWorksProps) {
    const [artistId, setArtistId] = useState<number | null>(null)
    const [artistData, setArtistData] = useState<ArtistDetailInfo | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const fetchArtistData = async () => {
            if (!track) return

            setIsLoading(true)
            setArtistData(null)

            try {
                // Determine artist name to search
                const artistName = track.artists.split(',')[0].split('/')[0].split('&')[0].trim()

                // 1. Resolve ID by name
                const id = await artistService.resolveArtistIdByName(artistName)
                if (id) {
                    setArtistId(id)
                    // 2. Fetch Detail
                    const data = await artistService.fetchArtistDetail(id)
                    setArtistData(data)
                }
            } catch (error) {
                console.error("Failed to fetch artist data", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchArtistData()
    }, [track])

    const handlePlaySong = (song: Track) => {
        // You can choose to just play the track or add to queue
        playerService.playTrack(song)
    }

    if (isLoading) {
        return (
            <div className="w-full max-w-md mx-auto p-4 flex justify-center mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
            </div>
        )
    }

    if (!artistData) {
        return null
    }

    return (
        <div className="w-full max-w-xl mx-auto p-4 mb-4 rounded-[12px] bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
            {/* Artist Header */}
            <div className="flex items-center gap-4 mb-6 px-2">
                <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-white/10 shadow-sm">
                    {artistData.artist.picUrl ? (
                        <img
                            src={artistData.artist.picUrl}
                            alt={artistData.artist.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/40 text-xs">
                            无图
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-[16px] font-semibold text-white">{artistData.artist.name}</h3>
                    <p className="text-[12px] text-white/50 mt-1">
                        {artistData.artist.musicSize} 首单曲 • {artistData.artist.albumSize} 张专辑
                    </p>
                </div>
            </div>

            {/* Representative Works (Top Songs) */}
            {artistData.songs && artistData.songs.length > 0 && (
                <div>
                    <h4 className="text-[16px] font-semibold text-white mb-4 px-2">
                        代表作品
                    </h4>
                    <div className="space-y-2">
                        {artistData.songs.slice(0, 5).map((song, index) => (
                            <div
                                key={song.id}
                                onClick={() => handlePlaySong(song)}
                                className="group flex items-center gap-3 p-2 rounded-[8px] hover:bg-white/10 cursor-pointer transition-colors"
                            >
                                <div className="w-8 text-center text-[14px] font-bold text-white/30 group-hover:text-white/70 transition-colors">
                                    {index + 1}
                                </div>
                                <div className="w-12 h-12 rounded-[6px] overflow-hidden shrink-0 relative">
                                    {song.picUrl ? (
                                        <img src={song.picUrl} alt={song.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-white/10"></div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <PlayCircle size={20} className="text-white" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <p className="text-[14px] font-semibold text-white truncate leading-tight mb-1">
                                        {song.name}
                                    </p>
                                    <p className="text-[12px] text-white/50 truncate leading-tight">
                                        {song.artists} • {song.album}
                                    </p>
                                </div>
                                <div className="pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PlayCircle size={16} className="text-white/50 hover:text-white transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
