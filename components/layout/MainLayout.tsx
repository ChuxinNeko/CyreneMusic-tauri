"use client"
import React, { useEffect, useState } from "react"

import { usePathname, useSearchParams } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { MobileNav } from "./MobileNav"
import { PlayerBar } from "../player/PlayerBar"
import { FullscreenPlayer } from "../player/FullscreenPlayer"
import { SetupWizard } from "../setup/SetupWizard"
import { updateService, UpdateInfo } from "@/lib/services/updateService"
import { UpdateDialog } from "../common/UpdateDialog"

export function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const isTray = pathname === "/tray"
    const isDesktopLyric = pathname === "/desktop-lyric"

    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [showUpdateDialog, setShowUpdateDialog] = useState(false)
    
    // Check if we are on a detail view (playlist, daily, album, or artist)
    const isPlaylistDetail = !!searchParams.get("playlist") || 
                            searchParams.get("view") === "daily" ||
                            pathname === "/album" ||
                            pathname === "/artist"

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener("contextmenu", handleContextMenu)

        // 检查更新
        const checkUpdate = async () => {
            // 稍作延迟，避开首屏加载高峰
            await new Promise(resolve => setTimeout(resolve, 3000))
            const info = await updateService.checkUpdate()
            if (info) {
                setUpdateInfo(info)
                setShowUpdateDialog(true)
            }
        }
        checkUpdate()

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
            <SetupWizard />
            <UpdateDialog 
                updateInfo={updateInfo} 
                open={showUpdateDialog} 
                onOpenChange={setShowUpdateDialog} 
            />
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
