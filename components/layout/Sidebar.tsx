import Image from "next/image"
import Link from "next/link"
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
                    <SidebarItem icon={Home} label="首页" href="/" isActive />
                    <SidebarItem icon={Compass} label="发现" href="/discover" />
                    <SidebarItem icon={Clock} label="历史" href="/history" />
                    <SidebarItem icon={HardDrive} label="本地" href="/local" />

                    <div className="py-2"></div>

                    <SidebarItem icon={User} label="我的" href="/profile" />
                    <SidebarItem icon={Settings} label="设置" href="/settings" />
                    <SidebarItem icon={HelpCircle} label="支持" href="/support" />
                    <SidebarItem icon={Code} label="DEV" href="/dev" />
                </div>
            </ScrollArea>
        </div>
    )
}
