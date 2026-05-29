"use client"

import React, { useEffect, useState } from "react"
import { Play, Pause, SkipForward } from "lucide-react"
import { listen, emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Track } from "@/lib/models/track"
import Image from "next/image"

export default function TaskbarPlayerPage() {
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        let unlistenState: (() => void) | null = null

        const setup = async () => {
            // Listen for state changes from main window FIRST
            unlistenState = await listen('player:state-change', (event: any) => {
                const payload = event.payload
                setCurrentTrack(payload.currentTrack)
                setIsPlaying(payload.isPlaying)
            })

            // Request current state from main window AFTER listening
            emit('player:command', 'request-sync')
        }

        setup()

        // Prevent right click
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener("contextmenu", handleContextMenu)

        return () => {
            if (unlistenState) unlistenState()
            document.removeEventListener("contextmenu", handleContextMenu)
        }
    }, [])

    const sendCommand = (command: string) => {
        emit('player:command', command)
    }

    const showMainWindow = async () => {
        const { getAllWindows } = await import("@tauri-apps/api/window")
        const windows = await getAllWindows()
        const main = windows.find((w) => w.label === "main")
        if (main) {
            await main.unminimize()
            await main.show()
            await main.setFocus()
        }
    }

    if (!currentTrack) {
        return <div className="w-full h-full bg-transparent" />
    }

    return (
        <div className="w-full h-full bg-transparent flex items-center px-3" data-tauri-drag-region>
            <style global jsx>{`
                html, body {
                    background: transparent !important;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>
            
            <div 
                className="group relative w-10 h-10 flex-shrink-0 cursor-pointer overflow-hidden rounded-md shadow-sm border border-white/10"
                onClick={showMainWindow}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                    src={currentTrack.picUrl || "/default-cover.png"} 
                    alt="cover" 
                    className="w-full h-full object-cover"
                />
            </div>

            <div 
                className="flex flex-col flex-1 mx-3 min-w-0 justify-center cursor-pointer select-none" 
                onClick={showMainWindow}
            >
                <span className="text-sm font-semibold truncate text-gray-500 drop-shadow-md">
                    {currentTrack.name}
                </span>
                <span className="text-xs text-gray-400 truncate drop-shadow-md">
                    {currentTrack.artists}
                </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:scale-110 transition drop-shadow-md" 
                    onClick={() => sendCommand('toggle-play')}
                >
                    {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
                </button>
                <button 
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:scale-110 transition drop-shadow-md" 
                    onClick={() => sendCommand('next')}
                >
                    <SkipForward size={20} />
                </button>
            </div>
        </div>
    )
}
