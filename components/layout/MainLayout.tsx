"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { MobileNav } from "./MobileNav"

export function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isTray = pathname === "/tray"

    if (isTray) {
        return <div className="h-screen w-full bg-background text-foreground overflow-hidden">{children}</div>
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <TitleBar />
                <main className="flex-1 overflow-auto pb-16 md:pb-0">
                    {children}
                </main>
            </div>
            <MobileNav />
        </div>
    )
}
