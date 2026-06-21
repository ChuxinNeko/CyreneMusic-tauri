"use client"

import { useEffect, useState } from "react"
import { Monitor, Power, Settings, Play, Pause, SkipForward, SkipBack } from "lucide-react"
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window"
import { exit } from "@tauri-apps/plugin-process"
import { listen, emit } from "@tauri-apps/api/event"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Track } from "@/lib/models/track"

export default function TrayPage() {
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    const resizeWindow = async () => {
        const container = document.getElementById('tray-container');
        if (container) {
            // Wait a tick for DOM to update
            setTimeout(async () => {
                const height = container.scrollHeight;
                const { LogicalSize } = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                await win.setSize(new LogicalSize(200, height));
            }, 0);
        }
    }

    useEffect(() => {
        // Initialize from store
        const state = usePlayerStore.getState()
        setCurrentTrack(state.currentTrack)
        setIsPlaying(state.isPlaying)

        // Request current state from main window
        emit('player:command', 'request-sync')

        // Listen for state changes from main window
        const unlisten = listen('player:state-change', (event: any) => {
            const payload = event.payload
            setCurrentTrack(payload.currentTrack)
            setIsPlaying(payload.isPlaying)
        })

        // Prevent right click on tray menu
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }

        // Hide window when it loses focus
        const handleBlur = async () => {
            await getCurrentWindow().hide()
        }

        document.addEventListener("contextmenu", handleContextMenu)
        window.addEventListener("blur", handleBlur)

        return () => {
            unlisten.then(f => f())
            document.removeEventListener("contextmenu", handleContextMenu)
            window.removeEventListener("blur", handleBlur)
        }
    }, [])

    useEffect(() => {
        resizeWindow();
    }, [currentTrack]);

    const sendCommand = (command: string) => {
        emit('player:command', command)
    }

    const showMainWindow = async () => {
        const windows = await getAllWindows()
        const main = windows.find((w) => w.label === "main")
        if (main) {
            await main.unminimize()
            await main.show()
            await main.setFocus()
        }
        await getCurrentWindow().hide()
    }

    const quitApp = async () => {
        await exit()
    }

    const openSettings = async () => {
        const windows = await getAllWindows()
        const main = windows.find((w) => w.label === "main")
        if (main) {
            await main.unminimize()
            await main.show()
            await main.setFocus()
        }
        await getCurrentWindow().hide()
    }

    return (
        <div
            id="tray-container"
            className="h-fit w-full bg-background border rounded-lg shadow-lg flex flex-col p-1 overflow-hidden"
        >
            <style global jsx>{`
                body {
                    user-select: none;
                    overflow: hidden;
                    background: transparent;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>

            {/* Media Control Section */}
            {currentTrack && (
                <div className="px-2 py-2 flex flex-col gap-1.5">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold truncate max-w-[180px]">
                            {currentTrack.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {currentTrack.artists}
                        </span>
                    </div>
                    <div className="flex items-center justify-between px-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onPointerDown={() => sendCommand('prev')}
                        >
                            <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onPointerDown={() => sendCommand('toggle-play')}
                        >
                            {isPlaying ? (
                                <Pause className="h-4 w-4 fill-current" />
                            ) : (
                                <Play className="h-4 w-4 fill-current ml-0.5" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onPointerDown={() => sendCommand('next')}
                        >
                            <SkipForward className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {currentTrack && <Separator className="my-1" />}

            <Button
                variant="ghost"
                className="justify-start gap-2 h-9 px-2 font-normal"
                onPointerDown={showMainWindow}
            >
                <Monitor className="h-4 w-4" />
                显示主界面
            </Button>
            <Button
                variant="ghost"
                className="justify-start gap-2 h-9 px-2 font-normal"
                onPointerDown={openSettings}
            >
                <Settings className="h-4 w-4" />
                设置
            </Button>
            <Separator className="my-1" />
            <Button
                variant="ghost"
                className="justify-start gap-2 h-9 px-2 font-normal hover:bg-destructive hover:text-destructive-foreground"
                onPointerDown={quitApp}
            >
                <Power className="h-4 w-4" />
                退出
            </Button>
        </div>
    )
}
