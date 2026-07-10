"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Compass, User, MoreHorizontal } from "lucide-react"
import { LiquidGlass } from "@/components/ui/LiquidGlass"
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
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex w-full justify-center px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pointer-events-none">
                <div className="relative isolate w-full max-w-sm overflow-hidden rounded-full bg-white/42 shadow-[0_14px_38px_rgba(15,23,42,0.26),inset_0_-12px_22px_rgba(15,23,42,0.08)] backdrop-blur-[34px] backdrop-saturate-[1.7] dark:bg-slate-950/58 dark:shadow-[0_16px_42px_rgba(0,0,0,0.56),inset_0_-14px_24px_rgba(0,0,0,0.3)] pointer-events-auto">
                    <LiquidGlass
                        intensity={48}
                        blur={34}
                        saturate={1.7}
                        edgeHighlight={0.72}
                        zIndex={0}
                    />
                    <div className="relative z-10 flex h-[68px] items-center justify-around px-2">
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
