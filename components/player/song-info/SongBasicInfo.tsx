"use client"

import React from "react"
import { Track } from "@/lib/models/track"
import { Disc } from "lucide-react"

interface SongBasicInfoProps {
    track: Track | null
}

export function SongBasicInfo({ track }: SongBasicInfoProps) {
    if (!track) return null

    return (
        <div className="w-full max-w-xl mx-auto mb-4 mt-8">
            <div className="w-full px-2 text-left space-y-3">
                <h2
                    className="text-2xl md:text-[28px] font-bold text-white tracking-tight leading-tight line-clamp-2"
                >
                    {track.name}
                </h2>
                <div className="flex flex-col items-start gap-2">
                    <p
                        className="text-[18px] text-white/80 transition-colors hover:text-white cursor-pointer px-1 py-0.5 rounded"
                    >
                        {track.artists.split(',').join(' / ')}
                    </p>
                    {track.album && (
                        <div className="flex items-center gap-1 mt-1 px-1 py-1 cursor-pointer hover:bg-white/5 rounded-md transition-colors">
                            <Disc size={14} className="text-white/60" />
                            <span
                                className="text-[14px] text-white/60 line-clamp-1"
                            >
                                {track.album}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
