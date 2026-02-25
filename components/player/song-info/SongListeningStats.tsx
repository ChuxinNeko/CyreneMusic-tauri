"use client"

import React, { useEffect, useState } from "react"
import { Track } from "@/lib/models/track"
import { historyService, HistoryEntry } from "@/lib/services/historyService"
import { listeningStatsService } from "@/lib/services/listeningStatsService"
import { neteaseSongWikiService } from "@/lib/services/neteaseSongWikiService"
import { Clock, RotateCcw } from "lucide-react"

interface SongListeningStatsProps {
    track: Track | null
}

const getSeasonAndPeriod = (date: Date) => {
    let season = '冬天';
    const month = date.getMonth() + 1;
    if (month >= 3 && month <= 5) season = '春天';
    else if (month >= 6 && month <= 8) season = '夏天';
    else if (month >= 9 && month <= 11) season = '秋天';

    let period = '深夜';
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) period = '早晨';
    else if (hour >= 12 && hour < 14) period = '中午';
    else if (hour >= 14 && hour < 18) period = '下午';
    else if (hour >= 18 && hour < 22) period = '傍晚';

    return `${season} · ${period}`;
}

const formatDate = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const HH = String(date.getHours()).padStart(2, '0')
    const MM = String(date.getMinutes()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd} ${HH}:${MM}`
}

export function SongListeningStats({ track }: SongListeningStatsProps) {
    const [memoryData, setMemoryData] = useState<{
        firstListenDate: string;
        firstListenDesc: string;
        playCount: number;
        playDescription: string;
    } | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const fetchMemory = async () => {
            if (!track) {
                setMemoryData(null)
                return
            }

            setIsLoading(true)
            try {
                // 1. 尝试从后端获取用户自己账号的播放记忆
                const userMemory = await listeningStatsService.fetchSongMemory(track.id, track.source)
                if (userMemory) {
                    let firstListenDateText = ''
                    let firstListenDescText = ''

                    if (userMemory.firstPlayedAt) {
                        const date = new Date(userMemory.firstPlayedAt)
                        firstListenDateText = formatDate(date)
                        firstListenDescText = getSeasonAndPeriod(date)
                    }

                    const playCount = userMemory.playCount || 0

                    if (firstListenDateText || playCount > 0) {
                        setMemoryData({
                            firstListenDate: firstListenDateText,
                            firstListenDesc: firstListenDescText,
                            playCount: playCount,
                            playDescription: playCount >= 10 ? '这首歌有在单曲循环吗？' : ''
                        })
                        return; // 成功获取后端记录，直接返回
                    }
                }

                // 2. 备用路径：如果是网易云音源，则尝试从网易云歌曲百科获取官方回忆坐标
                if (track.source === 'netease') {
                    const wikiData = await neteaseSongWikiService.fetchSongWiki(track.id)
                    if (wikiData && wikiData.blocks) {
                        const memoryBlock = wikiData.blocks.find(b => b.code === 'SONG_PLAY_ABOUT_MUSIC_MEMORY')
                        if (memoryBlock && memoryBlock.creatives) {
                            let firstListenDate = ''
                            let firstListenSeason = ''
                            let firstListenPeriod = ''
                            let playCount = 0
                            let playDescription = ''

                            for (const creative of memoryBlock.creatives) {
                                for (const res of creative.resources || []) {
                                    // 这里的格式根据实际网易云 API 结构调整，此处模拟 Flutter 中的结构
                                    const resType = (res as any).resourceType
                                    const resExt = (res as any).resourceExt
                                    if (resType === 'FIRST_LISTEN' && resExt?.musicFirstListenDto) {
                                        firstListenDate = resExt.musicFirstListenDto.date || ''
                                        firstListenSeason = resExt.musicFirstListenDto.season || ''
                                        firstListenPeriod = resExt.musicFirstListenDto.period || ''
                                    } else if (resType === 'TOTAL_PLAY' && resExt?.musicTotalPlayDto) {
                                        playCount = resExt.musicTotalPlayDto.playCount || 0
                                        playDescription = resExt.musicTotalPlayDto.text || ''
                                    }
                                }
                            }

                            if (firstListenDate || playCount > 0) {
                                setMemoryData({
                                    firstListenDate: firstListenDate,
                                    firstListenDesc: `${firstListenSeason} · ${firstListenPeriod}`,
                                    playCount: playCount,
                                    playDescription: playDescription
                                })
                                return; // 成功获取网易云官方记忆，直接返回
                            }
                        }
                    }
                }

                // 3. 最后路径：本地 IndexedDB 兜底
                const localStats = await historyService.getTrackStats(track.id, track.source)
                if (localStats && localStats.playCount > 0) {
                    let firstListenDateText = ''
                    let firstListenDescText = ''

                    if (localStats.firstPlayedAt) {
                        const date = new Date(localStats.firstPlayedAt)
                        firstListenDateText = formatDate(date)
                        firstListenDescText = getSeasonAndPeriod(date)
                    }

                    setMemoryData({
                        firstListenDate: firstListenDateText,
                        firstListenDesc: firstListenDescText,
                        playCount: localStats.playCount,
                        playDescription: localStats.playCount >= 10 ? '这首歌有在单曲循环吗？' : ''
                    })
                    return;
                }

                // 如果都没有，清空
                setMemoryData(null)
            } catch (err) {
                console.error("Failed to fetch memory stats", err)
                setMemoryData(null)
            } finally {
                setIsLoading(false)
            }
        }

        fetchMemory()
    }, [track])

    if (isLoading) {
        return (
            <div className="w-full max-w-xl mx-auto p-4 flex justify-center my-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50"></div>
            </div>
        )
    }

    if (!memoryData || (memoryData.firstListenDate === '' && memoryData.playCount === 0)) {
        return null
    }

    return (
        <div className="w-full max-w-xl mx-auto p-4 mb-4 rounded-[12px] bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
            <h3 className="text-[16px] font-semibold text-white mb-4 px-2">
                回忆坐标
            </h3>

            <div className="mx-2 p-5 rounded-[16px] bg-white/[0.08] flex flex-col gap-5">
                {memoryData.firstListenDate && (
                    <div className="flex items-start gap-3">
                        <Clock size={20} className="text-white/60 mt-0.5" strokeWidth={2} />
                        <div className="flex flex-col">
                            <span className="text-[12px] font-medium text-white/50 mb-1">
                                第一次听
                            </span>
                            <span className="text-[15px] text-white">
                                {memoryData.firstListenDate} {memoryData.firstListenDesc ? `· ${memoryData.firstListenDesc}` : ''}
                            </span>
                        </div>
                    </div>
                )}

                {memoryData.playCount > 0 && (
                    <div className="flex items-start gap-3">
                        <RotateCcw size={20} className="text-white/60 mt-0.5" strokeWidth={2} />
                        <div className="flex flex-col">
                            <span className="text-[12px] font-medium text-white/50 mb-1">
                                累计播放 {memoryData.playCount} 次
                            </span>
                            {memoryData.playDescription && (
                                <span className="text-[14px] italic text-white/80">
                                    {memoryData.playDescription}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
