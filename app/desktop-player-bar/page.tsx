"use client"

import { DesktopPlayerBar } from "@/components/player/DesktopPlayerBar"
import { useRemotePlayerSync } from "@/hooks/useRemotePlayerSync"

export default function DesktopPlayerBarPage() {
    const isReady = useRemotePlayerSync()

    if (!isReady) {
        return null
    }

    return (
        <main className="h-screen w-screen overflow-hidden bg-transparent p-0">
            <DesktopPlayerBar />
        </main>
    )
}