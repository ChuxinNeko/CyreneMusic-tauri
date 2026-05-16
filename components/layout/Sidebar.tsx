"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, Compass, Clock, HardDrive, User, Settings, HelpCircle, Code, ChevronLeft, ChevronRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { Button } from "@/components/ui/button"

interface SidebarItemProps {
    icon: React.ElementType
    label: string
    href: string
    isActive?: boolean
    isCollapsed: boolean
    onClick?: () => void
}

function SidebarItem({ icon: Icon, label, href, isActive, isCollapsed, onClick }: SidebarItemProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors h-10 overflow-hidden",
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            title={isCollapsed ? label : ""}
        >
            <div className="flex-shrink-0 w-10 flex items-center justify-center">
                <Icon className="h-4 w-4" />
            </div>
            <AnimatePresence mode="wait">
                {!isCollapsed && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="truncate ml-1"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </Link>
    )
}

export function Sidebar() {
    const pathname = usePathname()
    const { isSidebarCollapsed, toggleSidebar, devModeUnlocked, handleSettingsClick } = useLayoutStore()

    const navItems = [
        { icon: Home, label: "首页", href: "/" },
        { icon: Compass, label: "发现", href: "/discover" },
        { icon: Clock, label: "历史", href: "/history" },
        { icon: HardDrive, label: "本地", href: "/local" },
        { icon: User, label: "我的", href: "/profile" },
    ]

    const utilityItems = [
        { icon: Settings, label: "设置", href: "/settings", onClick: handleSettingsClick },
        { icon: HelpCircle, label: "支持", href: "/support" },
        ...(devModeUnlocked ? [{ icon: Code, label: "DEV", href: "/dev" }] : []),
    ]

    const isLinkActive = (href: string) => {
        if (href === "/") {
            return pathname === "/"
        }
        return pathname?.startsWith(href)
    }

    return (
        <motion.div
            initial={false}
            animate={{ width: isSidebarCollapsed ? 64 : 240 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="hidden md:flex border-r bg-muted/10 h-full flex-col relative"
        >
            <div className="h-14 flex items-center px-3 border-b select-none overflow-hidden" data-tauri-drag-region>
                <div className="flex items-center font-bold text-base pointer-events-none whitespace-nowrap min-w-0">
                    <div className="flex-shrink-0 w-10 flex items-center justify-center">
                        <Image src="/ico.png" alt="Logo" width={24} height={24} className="w-6 h-6" />
                    </div>
                    <AnimatePresence>
                        {!isSidebarCollapsed && (
                            <motion.span
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.15 }}
                                className="truncate ml-1"
                            >
                                CyreneMusicNext
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <ScrollArea className="flex-1 py-4">
                <div className="px-3 space-y-1">
                    {navItems.map((item) => (
                        <SidebarItem
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            isActive={isLinkActive(item.href)}
                            isCollapsed={isSidebarCollapsed}
                        />
                    ))}

                    <div className="py-2"></div>

                    {utilityItems.map((item) => (
                        <SidebarItem
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            isActive={isLinkActive(item.href)}
                            isCollapsed={isSidebarCollapsed}
                            onClick={'onClick' in item ? (item as any).onClick : undefined}
                        />
                    ))}
                </div>
            </ScrollArea>

            <div className="p-3 border-t">
                <Button
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="h-10 w-full flex items-center justify-start px-0 overflow-hidden group"
                >
                    <div className="flex-shrink-0 w-10 flex items-center justify-center">
                        {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </div>
                    <AnimatePresence>
                        {!isSidebarCollapsed && (
                            <motion.span
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.15 }}
                                className="text-xs text-muted-foreground font-medium truncate ml-1"
                            >
                                折叠边栏
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Button>
            </div>
        </motion.div>
    )
}
