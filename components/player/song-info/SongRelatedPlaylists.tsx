"use client"

import React, { useEffect, useState } from "react"
import { Track } from "@/lib/models/track"
import { neteaseSongWikiService } from "@/lib/services/neteaseSongWikiService"
import { PlayCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePlayerStore } from "@/lib/store/usePlayerStore"

interface SongRelatedPlaylistsProps {
    track: Track | null
}

interface RelatedPlaylist {
    id: string
    name: string
    imageUrl: string
    playCount: number
}

const formatPlayCount = (count: number) => {
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)}万`
    }
    return String(count)
}

export function SongRelatedPlaylists({ track }: SongRelatedPlaylistsProps) {
    const [playlists, setPlaylists] = useState<RelatedPlaylist[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const { setIsFullscreen } = usePlayerStore()

    useEffect(() => {
        const fetchRelatedPlaylists = async () => {
            if (!track || track.source !== 'netease') {
                setPlaylists([])
                return
            }

            setIsLoading(true)
            try {
                const wikiData = await neteaseSongWikiService.fetchSongWiki(track.id)
                if (wikiData && wikiData.blocks) {
                    const relatedBlock = wikiData.blocks.find(b => b.code === 'SONG_PLAY_ABOUT_RELATED_PLAYLIST')
                    const creatives = relatedBlock?.creatives || []

                    const lists: RelatedPlaylist[] = []

                    for (const creative of creatives) {
                        for (const res of creative.resources || []) {
                            const anyRes = res as any
                            if (anyRes.resourceType !== 'PLAYLIST') continue

                            const uiElement = anyRes.uiElement
                            if (!uiElement) continue

                            const title = uiElement.mainTitle?.title || ''

                            let imageUrl = ''
                            const images = uiElement.images || []
                            if (images.length > 0 && images[0]) {
                                imageUrl = (images[0].imageUrl || '').replace('http://', 'https://')
                            }

                            const resExt = anyRes.resourceExt || {}
                            const playCount = resExt.playCount || 0
                            const playlistId = anyRes.resourceId || ''

                            if (title) {
                                lists.push({
                                    id: playlistId,
                                    name: title,
                                    imageUrl: imageUrl,
                                    playCount: playCount
                                })
                            }
                        }
                    }

                    // 取前 9 个
                    setPlaylists(lists.slice(0, 9))
                } else {
                    setPlaylists([])
                }
            } catch (err) {
                console.error("Failed to parse related playlists", err)
                setPlaylists([])
            } finally {
                setIsLoading(false)
            }
        }

        fetchRelatedPlaylists()
    }, [track])

    const handleOpenPlaylist = (playlist: RelatedPlaylist) => {
        // 关闭全屏播放器
        setIsFullscreen(false)
        // 触发路由跳转显示歌单详情
        router.push(`/?playlist=${playlist.id}`)
    }

    if (isLoading) {
        return (
            <div className="w-full max-w-xl mx-auto p-4 flex justify-center mb-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50"></div>
            </div>
        )
    }

    if (playlists.length === 0) return null

    return (
        <div className="w-full max-w-xl mx-auto mb-8">
            <h4 className="text-[16px] font-semibold text-white mb-4 px-2">
                包含这首歌的歌单
            </h4>
            <div className="grid grid-cols-3 gap-3 px-2">
                {playlists.map((playlist, index) => (
                    <div
                        key={`${playlist.id}-${index}`}
                        onClick={() => handleOpenPlaylist(playlist)}
                        className="group cursor-pointer flex flex-col gap-2"
                    >
                        <div className="relative w-full aspect-square rounded-[8px] overflow-hidden bg-white/5">
                            {playlist.imageUrl ? (
                                <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-white/20 text-xs">暂无</span>
                                </div>
                            )}
                            {playlist.playCount > 0 && (
                                <div className="absolute top-1 right-1 flex items-center gap-1 text-white bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-md">
                                    <PlayCircle size={10} className="opacity-80" />
                                    <span className="text-[10px] font-semibold opacity-90">{formatPlayCount(playlist.playCount)}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <PlayCircle size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            </div>
                        </div>
                        <div className="px-1">
                            <p className="text-[12px] text-white/90 leading-[1.3] line-clamp-2 break-all font-medium transition-colors group-hover:text-white">
                                {playlist.name}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
