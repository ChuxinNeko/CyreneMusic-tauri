"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation" // Ensure this is imported
import { Home, Compass, Clock, HardDrive, User, Settings, HelpCircle, Code } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SidebarItemProps {
    icon: React.ElementType
    label: string
    href: string
    isActive?: boolean
}

function SidebarItem({ icon: Icon, label, href, isActive }: SidebarItemProps) {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
        >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
        </Link>
    )
}

export function Sidebar() {
    const pathname = usePathname()

    const navItems = [
        { icon: Home, label: "首页", href: "/" },
        { icon: Compass, label: "发现", href: "/discover" },
        { icon: Clock, label: "历史", href: "/history" },
        { icon: HardDrive, label: "本地", href: "/local" },
    ]

    const utilityItems = [
        // { icon: User, label: "我的", href: "/profile" }, // Removed, integrated into UserCard
        { icon: Settings, label: "设置", href: "/settings" },
        { icon: HelpCircle, label: "支持", href: "/support" },
        { icon: Code, label: "DEV", href: "/dev" },
    ]

    const isLinkActive = (href: string) => {
        if (href === "/") {
            return pathname === "/"
        }
        return pathname?.startsWith(href)
    }

    return (
        <div className="hidden md:flex w-60 border-r bg-muted/10 h-full flex-col">
            <div className="h-14 flex items-center px-6 border-b select-none" data-tauri-drag-region>
                {/* Logo Placeholder */}
                <div className="flex items-center gap-2 font-bold text-lg pointer-events-none">
                    <Image src="/ico.png" alt="Logo" width={24} height={24} className="w-6 h-6" />
                    Cyrene Music
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
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
