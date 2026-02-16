
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
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-1 h-full w-full",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
        >
            <Icon className={cn("h-6 w-6", isActive && "fill-current")} />
            <span className="text-[10px] font-medium">{label}</span>
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
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-lg border-t z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
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

            <MoreMenuSheet open={sheetOpen} onOpenChange={setSheetOpen} />
        </>
    )
}
