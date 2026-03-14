"use client"
import React, { useEffect } from "react"

import { usePathname, useSearchParams } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { MobileNav } from "./MobileNav"
import { PlayerBar } from "../player/PlayerBar"
import { FullscreenPlayer } from "../player/FullscreenPlayer"

export function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const isTray = pathname === "/tray"
    const isDesktopLyric = pathname === "/desktop-lyric"
    
    // Check if we are on a playlist detail view (assuming these are the params used in page.tsx)
    const isPlaylistDetail = !!searchParams.get("playlist") || searchParams.get("view") === "daily"

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
        <div className="flex flex-col h-screen overflow-hidden bg-background md:bg-transparent text-foreground">
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <div className={isPlaylistDetail ? 'hidden md:block' : 'block'}>
                        <TitleBar />
                    </div>
                    <main className={`flex-1 overflow-auto pb-[calc(80px+0rem)] md:pb-4 ${isPlaylistDetail ? 'pt-0' : ''}`}>
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

export function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <React.Suspense fallback={<div className="h-screen w-full bg-background" />}>
            <MainLayoutContent>{children}</MainLayoutContent>
        </React.Suspense>
    )
}
