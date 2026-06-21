"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Home, Compass, Clock, HardDrive, User, Settings, HelpCircle, Code, Menu, ChevronDown, ListMusic, Music2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useLayoutStore } from "@/lib/store/useLayoutStore"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist } from "@/lib/models/playlist"
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
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full"
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

/* ─── 收藏歌单子菜单项 ─── */
function PlaylistMenuItem({ playlist, isActive, onClick }: {
    playlist: Playlist
    isActive: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "group relative flex items-center w-full min-w-0 text-left text-[13px] rounded-md transition-all duration-150 h-8 pl-8 pr-2 overflow-hidden",
                isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
            title={playlist.name}
        >
            {isActive && (
                <div
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-primary rounded-full"
                />
            )}
            <Music2 className={cn(
                "h-3.5 w-3.5 flex-shrink-0 mr-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground/60"
            )} />
            <span className="truncate min-w-0 flex-1">{playlist.name.length > 10 ? playlist.name.slice(0, 10) + '…' : playlist.name}</span>
            {playlist.trackCount > 0 && (
                <span className={cn(
                    "ml-auto flex-shrink-0 text-[10px] tabular-nums px-1 rounded",
                    isActive ? "text-primary/70" : "text-muted-foreground/40"
                )}>
                    {playlist.trackCount}
                </span>
            )}
        </button>
    )
}

/* ─── 收藏歌单折叠区域 ─── */
function PlaylistSection({ isCollapsed }: { isCollapsed: boolean }) {
    const { isLoggedIn } = useAuthStore()
    const router = useRouter()
    const pathname = usePathname()
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [isExpanded, setIsExpanded] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    // 获取当前选中的歌单 ID（从 URL query 中）
    const activePlaylistId = React.useMemo(() => {
        if (typeof window === "undefined") return null
        const params = new URLSearchParams(window.location.search)
        return pathname === "/profile" ? params.get("playlist") : null
    }, [pathname])

    const fetchPlaylists = useCallback(async () => {
        if (!isLoggedIn) {
            setPlaylists([])
            return
        }
        setIsLoading(true)
        try {
            const data = await playlistService.getPlaylists()
            setPlaylists(data)
        } catch (e) {
            console.error("[FluentSidebar] Failed to fetch playlists:", e)
        } finally {
            setIsLoading(false)
        }
    }, [isLoggedIn])

    // 登录状态变化或路由变化时刷新歌单
    useEffect(() => {
        fetchPlaylists()
    }, [fetchPlaylists, pathname])

    const handlePlaylistClick = (playlistId: number) => {
        router.push(`/profile?playlist=${playlistId}`)
    }

    // 侧边栏折叠或未登录时不显示
    if (isCollapsed || !isLoggedIn) return null

    return (
        <div className="mt-2 min-w-0 overflow-hidden">
            {/* 分组标题 - 可点击折叠 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="group flex items-center w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
            >
                <ListMusic className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span className="truncate">
                    收藏歌单
                </span>
                {playlists.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground/30 tabular-nums">
                        {playlists.length}
                    </span>
                )}
                <div
                    className="ml-auto transition-transform duration-200"
                    style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                >
                    <ChevronDown className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </div>
            </button>

            {/* 歌单列表 - CSS 动画展开/折叠，避免 framer-motion layout 抖动 */}
            <div
                className="overflow-hidden transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{
                    display: 'grid',
                    gridTemplateRows: isExpanded ? '1fr' : '0fr',
                    opacity: isExpanded ? 1 : 0,
                }}
            >
                <div className="min-h-0">
                    <div className="px-2 py-0.5 space-y-px">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : playlists.length === 0 ? (
                            <div className="py-4 px-3 text-center">
                                <p className="text-[11px] text-muted-foreground/40">暂无收藏歌单</p>
                            </div>
                        ) : (
                            playlists.map((playlist) => (
                                <PlaylistMenuItem
                                    key={playlist.id}
                                    playlist={playlist}
                                    isActive={activePlaylistId === String(playlist.id)}
                                    onClick={() => handlePlaylistClick(playlist.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
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

    const isLinkActive = (href: string) => {
        if (href === "/") {
            return pathname === "/"
        }
        return pathname?.startsWith(href)
    }

    return (
        <div
            className="hidden md:flex flex-shrink-0 bg-muted/10 h-full flex-col relative overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
            style={{ width: isSidebarCollapsed ? 64 : 240 }}
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
            <ScrollArea className="flex-1 py-3 overflow-hidden">
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
                </div>

                {/* 收藏歌单二级菜单 */}
                <PlaylistSection isCollapsed={isSidebarCollapsed} />
            </ScrollArea>

            {/* 底部固定区域 - 工具项 + 设置，留出播放器空间 */}
            <div className="px-2 pb-1 pt-2 border-t border-border/50 space-y-0.5">
                <FluentSidebarItem
                    icon={HelpCircle}
                    label="支持"
                    href="/support"
                    isActive={isLinkActive("/support")}
                    isCollapsed={isSidebarCollapsed}
                />
                {devModeUnlocked && (
                    <FluentSidebarItem
                        icon={Code}
                        label="DEV"
                        href="/dev"
                        isActive={isLinkActive("/dev")}
                        isCollapsed={isSidebarCollapsed}
                    />
                )}
                <FluentSidebarItem
                    icon={Settings}
                    label="设置"
                    href="/settings"
                    isActive={isLinkActive("/settings")}
                    isCollapsed={isSidebarCollapsed}
                    onClick={handleSettingsClick}
                />
            </div>
        </div>
    )
}