"use client"

import React, { useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useIsMobile } from "@/hooks/use-mobile"
import { announcementService, Announcement } from "@/lib/services/announcementService"

export function AnnouncementDialog() {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null)
    const [open, setOpen] = useState(false)
    const isMobile = useIsMobile()

    useEffect(() => {
        const load = async () => {
            await new Promise(resolve => setTimeout(resolve, 1500))
            const data = await announcementService.fetchAnnouncement()
            if (data && !announcementService.isDismissed(data.id)) {
                setAnnouncement(data)
                setOpen(true)
            }
        }
        load()
    }, [])

    const handleClose = () => {
        if (announcement) {
            announcementService.dismiss(announcement.id)
        }
        setOpen(false)
    }

    if (!announcement) return null

    const Content = (
        <div className="flex flex-col gap-4">
            <ScrollArea className={`${isMobile ? 'max-h-[300px]' : 'max-h-[250px]'} w-full rounded-md border p-4 bg-muted/50`}>
                <div className="text-sm whitespace-pre-line leading-relaxed break-words overflow-hidden">
                    {announcement.content}
                </div>
            </ScrollArea>
            <Button className="w-full" onClick={handleClose}>
                我知道了
            </Button>
        </div>
    )

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
                <SheetContent side="bottom" className="rounded-t-[20px] px-6 pb-8 pt-2 max-h-[80vh] flex flex-col overflow-hidden">
                    <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted mb-4 shrink-0" />
                    <SheetHeader className="text-left gap-1 p-0 mb-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5 text-primary" />
                            <SheetTitle className="text-xl">
                                {announcement.title || "公告"}
                            </SheetTitle>
                        </div>
                        <SheetDescription>
                            来自 Cyrene Music 的通知
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 min-h-0 flex-1">
                        <ScrollArea className="min-h-0 flex-1 w-full rounded-md border p-4 bg-muted/50">
                            <div className="text-sm whitespace-pre-line leading-relaxed break-words">
                                {announcement.content}
                            </div>
                        </ScrollArea>
                        <Button className="w-full shrink-0" onClick={handleClose}>
                            我知道了
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="gap-2">
                    <div className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-primary" />
                        <DialogTitle className="text-xl">
                            {announcement.title || "公告"}
                        </DialogTitle>
                    </div>
                    <DialogDescription>
                        来自 Cyrene Music 的通知
                    </DialogDescription>
                </DialogHeader>
                {Content}
            </DialogContent>
        </Dialog>
    )
}