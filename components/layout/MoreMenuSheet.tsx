
"use client"

import { Clock, HardDrive, Settings, HelpCircle, Code } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"

interface MenuItemProps {
    icon: React.ElementType
    label: string
    href: string
    onClick?: () => void
}

function MenuItem({ icon: Icon, label, href, onClick }: MenuItemProps) {
    const pathname = usePathname()
    const isActive = pathname === href

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors",
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
        >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
        </Link>
    )
}

interface MoreMenuSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MoreMenuSheet({ open, onOpenChange }: MoreMenuSheetProps) {
    const closeSheet = () => onOpenChange(false)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl px-2 pb-6">
                <SheetHeader className="mb-2">
                    <SheetTitle>更多应用</SheetTitle>
                </SheetHeader>
                <div className="grid gap-1">
                    <MenuItem icon={Clock} label="历史" href="/history" onClick={closeSheet} />
                    <MenuItem icon={HardDrive} label="本地" href="/local" onClick={closeSheet} />
                    <div className="h-px bg-border my-2 mx-4" />
                    <MenuItem icon={Settings} label="设置" href="/settings" onClick={closeSheet} />
                    <MenuItem icon={HelpCircle} label="支持" href="/support" onClick={closeSheet} />
                    <MenuItem icon={Code} label="DEV" href="/dev" onClick={closeSheet} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
