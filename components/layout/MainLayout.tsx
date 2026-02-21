"use client"
import React, { useEffect } from "react"

import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { MobileNav } from "./MobileNav"
import { PlayerBar } from "../player/PlayerBar"
import { FullscreenPlayer } from "../player/FullscreenPlayer"

export function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isTray = pathname === "/tray"
    const isDesktopLyric = pathname === "/desktop-lyric"

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener("contextmenu", handleContextMenu)
        return () => {
            document.removeEventListener("contextmenu", handleContextMenu)
        }
    }, [])

    if (isTray || isDesktopLyric) {
        return <div className="h-screen w-full bg-background/0 overflow-hidden">{children}</div>
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <TitleBar />
                    <main className="flex-1 overflow-auto">
                        {children}
                    </main>
                </div>
            </div>
            <PlayerBar />
            <MobileNav />
            <FullscreenPlayer />
        </div>
    )
}
