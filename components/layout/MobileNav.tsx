"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Compass, User, MoreHorizontal } from "lucide-react"
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
            <div className="md:hidden w-full flex-shrink-0 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border-t z-40 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-around px-2 h-[72px]">
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

            <MoreMenuSheet open={sheetOpen} onOpenChange={setSheetOpen} />
        </>
    )
}
