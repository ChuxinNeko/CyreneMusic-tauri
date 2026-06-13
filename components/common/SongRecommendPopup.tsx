"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen, emit } from "@tauri-apps/api/event"
import { Track } from "@/lib/models/track"
import { discoveryService } from "@/lib/services/discoveryService"
import { accountService } from "@/lib/services/accountService"
import { playerService } from "@/lib/services/playerService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { toast } from "sonner"

/**
 * 歌曲推荐弹窗调度器（在主窗口内运行）
 * 
 * 负责：
 * 1. 获取推荐歌曲数据
 * 2. 调用 Rust 创建独立推荐窗口
 * 3. 通过 Tauri event 将数据发送给推荐窗口
 * 4. 监听推荐窗口的播放请求
 * 
 * 不渲染任何可见 UI。
 */
export function SongRecommendPopup() {
    const [hasShownOnce, setHasShownOnce] = useState(false)
    const isFetchingRef = useRef(false)
    const tracksRef = useRef<Track[]>([])
    const coverUrlRef = useRef("")

    const { token } = useAuthStore()
    const { showDailyRecommendPopup, _recommendPopupTrigger } = useLayoutStore()

    const fetchRecommendSongs = useCallback(async (): Promise<Track[]> => {
        try {
            let isBound = false
            if (token) {
                isBound = await accountService.isNeteaseBound(token)
            }

            if (isBound && token) {
                const data = await discoveryService.getRecommendForYou(token)
                if (data?.dailySongs?.length) {
                    const allSongs = data.dailySongs
                    const shuffled = [...allSongs].sort(() => 0.5 - Math.random())
                    return shuffled.slice(0, 5).map(s => discoveryService.convertToTrack(s))
                }
            }

            // 未绑定或获取失败：从排行榜随机
            const toplists = await discoveryService.getToplists()
            const allTracks = toplists.flatMap(list => list.tracks)
            if (allTracks.length > 0) {
                const shuffled = [...allTracks].sort(() => 0.5 - Math.random())
                return shuffled.slice(0, 5).map(t => discoveryService.convertToTrack(t))
            }

            return []
        } catch (e) {
            console.error("[SongRecommendPopup] fetchRecommendSongs failed:", e)
            return []
        }
    }, [token])

    const showPopup = useCallback(async () => {
        if (isFetchingRef.current) return
        isFetchingRef.current = true

        try {
            const songs = await fetchRecommendSongs()
            if (songs.length > 0) {
                tracksRef.current = songs
                const randomSong = songs[Math.floor(Math.random() * songs.length)]
                coverUrlRef.current = randomSong.picUrl

                // 调用 Rust 创建独立窗口
                await invoke("open_recommend_popup")

                // 短暂延迟后发送数据，等窗口 ready
                setTimeout(() => {
                    emit("recommend:data", {
                        tracks: songs,
                        coverUrl: coverUrlRef.current
                    })
                }, 500)
            }
        } catch (e) {
            console.error("[SongRecommendPopup] showPopup failed:", e)
        } finally {
            isFetchingRef.current = false
        }
    }, [fetchRecommendSongs])

    // 启动时自动显示
    useEffect(() => {
        if (hasShownOnce || !showDailyRecommendPopup) return

        const timer = setTimeout(() => {
            setHasShownOnce(true)
            showPopup()
        }, 3000)

        return () => clearTimeout(timer)
    }, [showDailyRecommendPopup, hasShownOnce, showPopup])

    // 手动触发（来自设置页）
    useEffect(() => {
        if (_recommendPopupTrigger === 0) return
        showPopup()
    }, [_recommendPopupTrigger, showPopup])

    // 监听推荐窗口的数据请求（窗口可能在数据发送前就已 ready）
    useEffect(() => {
        const unlisten = listen("recommend:request-data", () => {
            if (tracksRef.current.length > 0) {
                emit("recommend:data", {
                    tracks: tracksRef.current,
                    coverUrl: coverUrlRef.current
                })
            }
        })

        return () => { unlisten.then(f => f()) }
    }, [])

    // 监听推荐窗口的播放请求
    useEffect(() => {
        const unlisten = listen<{ track: Track; queue: Track[] }>("recommend:play", (event) => {
            const { track, queue } = event.payload
            playerService.playWithQueue(track, queue)
            toast.success(`正在播放: ${track.name}`)
        })

        return () => { unlisten.then(f => f()) }
    }, [])

    // 不渲染任何 UI
    return null
}
