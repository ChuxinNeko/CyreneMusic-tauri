"use client"

import React from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { SongBasicInfo } from "./SongBasicInfo"
import { SongWiki } from "./SongWiki"
import { SongListeningStats } from "./SongListeningStats"
import { SongSimilarSongs } from "./SongSimilarSongs"
import { SongRelatedPlaylists } from "./SongRelatedPlaylists"
import { ArtistWorks } from "./ArtistWorks"

export function SongInfoPanel() {
    const { currentTrack } = usePlayerStore()

    return (
        <div className="w-full h-full overflow-y-auto no-scrollbar pb-32">
            <div className="min-h-full flex flex-col items-center justify-start py-8 px-4 lg:px-8 max-w-2xl mx-auto">
                {/* 歌曲基础信息 */}
                <SongBasicInfo track={currentTrack} />

                {/* 音乐百科 (仅网易云) */}
                <SongWiki track={currentTrack} />

                {/* 听歌足迹 */}
                <SongListeningStats track={currentTrack} />

                {/* 相似歌曲 (仅网易云) */}
                <SongSimilarSongs track={currentTrack} />

                {/* 包含这首歌的歌单 (仅网易云) */}
                <SongRelatedPlaylists track={currentTrack} />

                {/* 歌手代表作 */}
                <ArtistWorks track={currentTrack} />
            </div>
        </div>
    )
}
