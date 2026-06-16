"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Home, Compass, Clock, HardDrive, User, Settings, HelpCircle, Code, Menu } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { Button } from "@/components/ui/button"

interface FluentSidebarItemProps {
    icon: React.ElementType
    label: string
    href: string
    isActive?: boolean
    isCollapsed: boolean
    onClick?: () => void
}

function FluentSidebarItem({ icon: Icon, label, href, isActive, isCollapsed, onClick }: FluentSidebarItemProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "group relative flex items-center py-2 text-sm font-medium rounded-lg transition-all duration-200 h-10 overflow-hidden",
                isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={isCollapsed ? label : ""}
        >
            {/* Fluent 风格的活跃指示器 */}
            {isActive && (
                <motion.div
                    layoutId="fluent-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <div className="flex-shrink-0 w-12 flex items-center justify-center">
                <Icon className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    "group-hover:scale-110"
                )} />
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

export function FluentSidebar() {
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
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="hidden md:flex flex-shrink-0 bg-muted/10 h-full flex-col relative overflow-hidden"
        >
            {/* Fluent 风格的顶部区域 - 始终保留应用图标 */}
            <div className="h-14 flex items-center px-2 select-none overflow-hidden" data-tauri-drag-region>
                <div className="flex-shrink-0 w-12 flex items-center justify-center pointer-events-none">
                    <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Image src="/ico.png" alt="Logo" width={24} height={24} className="w-6 h-6 rounded-md" />
                    </motion.div>
                </div>
                <AnimatePresence>
                    {!isSidebarCollapsed && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15 }}
                            className="font-bold text-base pointer-events-none truncate ml-1"
                        >
                            CyreneMusicNext
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* 折叠按钮作为单独的一项 */}
            <div className="px-2 pb-2">
                <Button
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="h-10 w-12 p-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center"
                >
                    <Menu className="h-4 w-4" />
                </Button>
            </div>

            {/* 导航区域 - Fluent 风格的间距 */}
            <ScrollArea className="flex-1 py-3">
                <div className="px-2 space-y-0.5">
                    {navItems.map((item) => (
                        <FluentSidebarItem
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            isActive={isLinkActive(item.href)}
                            isCollapsed={isSidebarCollapsed}
                        />
                    ))}

                    {/* 分隔线 - Fluent 风格 */}
                    <div className="py-2 mx-3">
                        <div className="h-px bg-border" />
                    </div>

                    {utilityItems.map((item) => (
                        <FluentSidebarItem
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
        </motion.div>
    )
}