"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Compass, User, MoreHorizontal } from "lucide-react"
import LiquidGlass from '@nkzw/liquid-glass'
import { cn } from "@/lib/utils"
import { MoreMenuSheet } from "./MoreMenuSheet"

interface NavItemProps {
    icon: React.ElementType
    label: string
    href?: string
    isActive?: boolean
    onClick?: () => void
}

function NavItem({ icon: Icon, label, href, isActive, onClick }: NavItemProps) {
    const content = (
        <div className="flex flex-col items-center justify-center w-full h-full">
            <div
                className={cn(
                    "flex flex-col items-center justify-center transition-all duration-200",
                    isActive 
                        ? "bg-primary/10 text-primary rounded-2xl px-5 py-1.5 shadow-sm gap-0.5" 
                        : "text-muted-foreground hover:text-foreground p-1.5 gap-1"
                )}
            >
                {/* Always use stroke instead of filling the icons entirely to maintain consistency. */}
                <Icon className={cn("h-6 w-6", isActive && "stroke-current stroke-[2.5px]")} />
                <span className={cn(
                    "font-medium transition-all duration-200",
                    isActive ? "text-[11px] font-bold" : "text-[10px]"
                )}>{label}</span>
            </div>
        </div>
    )

    if (href) {
        return (
            <Link href={href} className="flex-1 h-full" onClick={onClick}>
                {content}
            </Link>
        )
    }

    return (
        <button className="flex-1 h-full" onClick={onClick}>
            {content}
        </button>
    )
}

export function MobileNav() {
    const pathname = usePathname()
    const [sheetOpen, setSheetOpen] = React.useState(false)

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 w-full z-40 pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4 pointer-events-none flex justify-center">
                <div className="relative w-full max-w-sm pointer-events-auto rounded-full border border-black/5 dark:border-white/5 bg-white/5 dark:bg-black/5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-3xl overflow-hidden">
                    <LiquidGlass
                        className=""
                        displacementScale={72}
                        blurAmount={0.075}
                        saturation={145}
                        aberrationIntensity={2}
                        elasticity={0.22}
                        borderRadius={999}
                        padding="0"
                        style={{ position: "absolute", inset: 0 }}
                    >
                        <></>
                    </LiquidGlass>
                    <div className="relative z-10 flex items-center justify-around px-2 h-[68px]">
                    <NavItem
                        icon={Home}
                        label="首页"
                        href="/"
                        isActive={pathname === "/"}
                    />
                    <NavItem
                        icon={Compass}
                        label="发现"
                        href="/discover"
                        isActive={pathname === "/discover"}
                    />
                    <NavItem
                        icon={User}
                        label="我的"
                        href="/profile"
                        isActive={pathname === "/profile"}
                    />
                    <NavItem
                        icon={MoreHorizontal}
                        label="更多"
                        onClick={() => setSheetOpen(true)}
                        isActive={sheetOpen}
                    />
                </div>
                </div>
            </div>

            <MoreMenuSheet open={sheetOpen} onOpenChange={setSheetOpen} />
        </>
    )
}
