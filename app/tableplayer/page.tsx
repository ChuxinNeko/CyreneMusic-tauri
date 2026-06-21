"use client"

import React, { useEffect, useState } from "react"
import { listen, emit } from "@tauri-apps/api/event"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { RightSidebarPlayer } from "@/components/layout/RightSidebarPlayer"
import { getCurrentWindow } from "@tauri-apps/api/window"

export default function TablePlayerPage() {
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        let unlistenState: (() => void) | null = null
        let unlistenTime: (() => void) | null = null

        const setup = async () => {
            unlistenState = await listen("player:state-change", (event: any) => {
                const payload = event.payload
                usePlayerStore.setState({
                    currentTrack: payload.currentTrack,
                    isPlaying: payload.isPlaying
                })
            })

            unlistenTime = await listen("player:time-sync", (event: any) => {
                const payload = event.payload
                const store = usePlayerStore.getState()
                if (store.duration) {
                    usePlayerStore.setState({
                        currentTime: payload.time,
                        progress: payload.time / store.duration
                    })
                } else {
                    usePlayerStore.setState({ currentTime: payload.time })
                }
            })

            // Request initial sync
            emit("player:command", "request-sync")
            setIsReady(true)

            // Setup drag region on the body or wrapper if we want to allow dragging
        }

        setup()

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'player-storage' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue)
                    if (parsed.state?.queue) {
                        usePlayerStore.setState({ queue: parsed.state.queue })
                    }
                } catch (err) {}
            }
        }
        window.addEventListener('storage', handleStorage)

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener("contextmenu", handleContextMenu)

        return () => {
            if (unlistenState) unlistenState()
            if (unlistenTime) unlistenTime()
            window.removeEventListener('storage', handleStorage)
            document.removeEventListener("contextmenu", handleContextMenu)
        }
    }, [])

    if (!isReady) return null

    return (
        <div className="w-full h-full bg-transparent flex" data-tauri-drag-region>
            <style global jsx>{`
                html, body {
                    background: transparent !important;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>
            <RightSidebarPlayer isStandalone={true} />
        </div>
    )
}
