
"use client"

import { useEffect } from "react"
import { Monitor, Power, Settings } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { getAllWindows } from "@tauri-apps/api/window"
import { exit } from "@tauri-apps/plugin-process"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function TrayPage() {
    useEffect(() => {
        // Prevent right click on tray menu
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }

        // Hide window when it loses focus (clicked outside)
        const handleBlur = async () => {
            await getCurrentWindow().hide()
        }

        document.addEventListener("contextmenu", handleContextMenu)

        // We need to attach blur listener to the window
        // But getCurrentWindow() returns a Promise in v2 usually, or we can use the window object if it's available?
        // Actually @tauri-apps/api/window getCurrentWindow() returns the WebviewWindow instance.
        // We can listen to the Tauri window event using .listen or just standard window.addEventListener('blur')?
        // Standard window 'blur' event works for webview losing focus.
        window.addEventListener("blur", handleBlur)

        return () => {
            document.removeEventListener("contextmenu", handleContextMenu)
            window.removeEventListener("blur", handleBlur)
        }
    }, [])

    const showMainWindow = async () => {
        const windows = await getAllWindows()
        const main = windows.find((w) => w.label === "main")
        if (main) {
            await main.unminimize()
            await main.show()
            await main.setFocus()
        }
        // Hide tray window
        await getCurrentWindow().hide()
    }

    const quitApp = async () => {
        await exit()
    }

    const openSettings = async () => {
        const windows = await getAllWindows()
        const main = windows.find((w) => w.label === "main")
        if (main) {
            // In a real app we might navigate to settings, but for now just show window
            // Navigating remotely is harder, we'll just show window
            await main.unminimize()
            await main.show()
            await main.setFocus()
        }
        await getCurrentWindow().hide()
    }

    return (
        <div className="h-full w-full bg-background border rounded-lg shadow-lg flex flex-col p-1">
            <style global jsx>{`
                body {
                    user-select: none;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>
            <Button
                variant="ghost"
                className="justify-start gap-2 h-9 px-2 font-normal"
                onClick={showMainWindow}
            >
                <Monitor className="h-4 w-4" />
                显示主界面
            </Button>
            <Button
                variant="ghost"
                className="justify-start gap-2 h-9 px-2 font-normal"
                onClick={openSettings}
            >
                <Settings className="h-4 w-4" />
                设置
            </Button>
            <Separator className="my-1" />
            <Button
                variant="ghost"
                className="justify-start gap-2 h-9 px-2 font-normal hover:bg-destructive hover:text-destructive-foreground"
                onClick={quitApp}
            >
                <Power className="h-4 w-4" />
                退出
            </Button>
        </div>
    )
}
