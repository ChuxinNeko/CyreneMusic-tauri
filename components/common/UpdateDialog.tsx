
"use client"

import React from "react"
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
    SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { UpdateInfo, updateService } from "@/lib/services/updateService"
import { AlertTriangle, MessageSquare } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useIsMobile } from "@/hooks/use-mobile"

interface UpdateDialogProps {
    updateInfo: UpdateInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
    updateInfo,
    open,
    onOpenChange,
}) => {
    const isMobile = useIsMobile()
    
    if (!updateInfo) return null

    const isForceUpdate = updateInfo.force_update

    const handleOpenChange = (newOpen: boolean) => {
        if (isForceUpdate) return
        onOpenChange(newOpen)
    }

    const Content = (
        <div className="flex flex-col gap-4">
            <div className="space-y-2">
                <h4 className="text-sm font-medium leading-none">更新记录</h4>
                <ScrollArea className={`${isMobile ? 'h-[200px]' : 'h-[150px]'} w-full rounded-md border p-4 bg-muted/50`}>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {updateInfo.changelog || "作者暂未提供详细更新记录。"}
                    </div>
                </ScrollArea>
            </div>

            {isForceUpdate && (
                <div className="flex items-start gap-3 rounded-md bg-destructive/10 p-3 border border-destructive/20 text-destructive text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                        <p className="font-bold">强制更新提示</p>
                        <p className="text-xs opacity-90">此版本包含关键更新，必须升级后才能继续使用应用。</p>
                    </div>
                </div>
            )}

            <div className="rounded-md bg-primary/5 p-3 border border-primary/10 text-xs text-muted-foreground">
                <p>请点击下方链接加入 QQ 群，在群文件中下载最新版本的安装包（.exe / .apk）。</p>
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" onClick={() => window.open("https://qm.qq.com/q/5UADyZm3vi", "_blank")}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    前往 QQ 群下载
                </Button>
                {!isForceUpdate && (
                    <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                        以后再说
                    </Button>
                )}
                <div className="text-[10px] text-muted-foreground text-center pt-1">
                    当前版本: v{updateService.CURRENT_VERSION}
                </div>
            </div>
        </div>
    )

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent 
                    side="bottom" 
                    className="rounded-t-[20px] px-6 pb-8 pt-2"
                    showCloseButton={!isForceUpdate}
                    onPointerDownOutside={(e) => isForceUpdate && e.preventDefault()}
                    onEscapeKeyDown={(e) => isForceUpdate && e.preventDefault()}
                >
                    <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted mb-4" />
                    <SheetHeader className="text-left gap-1 p-0 mb-4">
                        <div className="flex items-center gap-2">
                            <SheetTitle className="text-xl">发现新版本</SheetTitle>
                            <Badge variant="secondary" className="font-mono">
                                v{updateInfo.version}
                            </Badge>
                        </div>
                        <SheetDescription>
                            Cyrene Music Next 有新的更新可用。
                        </SheetDescription>
                    </SheetHeader>
                    {Content}
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent 
                className="sm:max-w-[425px]" 
                showCloseButton={!isForceUpdate}
                onPointerDownOutside={(e) => isForceUpdate && e.preventDefault()}
                onEscapeKeyDown={(e) => isForceUpdate && e.preventDefault()}
            >
                <DialogHeader className="gap-2">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="text-xl">发现新版本</DialogTitle>
                        <Badge variant="secondary" className="font-mono">
                            v{updateInfo.version}
                        </Badge>
                    </div>
                    <DialogDescription>
                        Cyrene Music Next 有新的更新可用。
                    </DialogDescription>
                </DialogHeader>
                {Content}
            </DialogContent>
        </Dialog>
    )
}
