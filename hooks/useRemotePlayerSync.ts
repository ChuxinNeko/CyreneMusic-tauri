"use client"

import { useEffect, useState } from "react"
import { emit, listen } from "@tauri-apps/api/event"
import { Track } from "@/lib/models/track"
import { usePlayerStore } from "@/lib/store/usePlayerStore"

type PlayerStatePayload = {
    currentTrack: Track | null
    isPlaying: boolean
    duration?: number
}

type PlayerTimePayload = {
    time: number
    duration?: number
}

type PlayerFrequencyPayload = {
    barData?: number[]
}

export function useRemotePlayerSync() {
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        let disposed = false
        const unlisteners: Array<() => void> = []

        const subscribe = async () => {
            const stopState = await listen<PlayerStatePayload>("player:state-change", ({ payload }) => {
                usePlayerStore.setState({
                    currentTrack: payload.currentTrack,
                    isPlaying: payload.isPlaying,
                    ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
                })
            })

            if (disposed) {
                stopState()
                return
            }
            unlisteners.push(stopState)

            const stopTime = await listen<PlayerTimePayload>("player:time-sync", ({ payload }) => {
                const { duration } = usePlayerStore.getState()
                const syncedDuration = payload.duration ?? duration

                usePlayerStore.setState({
                    currentTime: payload.time,
                    ...(syncedDuration > 0
                        ? { duration: syncedDuration, progress: payload.time / syncedDuration }
                        : {}),
                })
            })

            if (disposed) {
                stopTime()
                return
            }
            unlisteners.push(stopTime)

            const stopFrequency = await listen<PlayerFrequencyPayload>("player:frequency-sync", ({ payload }) => {
                usePlayerStore.setState({ remoteBarData: payload?.barData ?? null })
            })

            if (disposed) {
                stopFrequency()
                return
            }
            unlisteners.push(stopFrequency)

            await emit("player:command", "request-sync")
            if (!disposed) {
                setIsReady(true)
            }
        }

        void subscribe()

        return () => {
            disposed = true
            unlisteners.forEach((unlisten) => unlisten())
        }
    }, [])

    return isReady
}