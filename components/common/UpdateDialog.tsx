
"use client"

import React, { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { UpdateInfo, updateService } from "@/lib/services/updateService"
import { AlertTriangle, Download, Monitor, Smartphone, Apple, Laptop } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { openPath, openUrl } from "@tauri-apps/plugin-opener"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useIsMobile } from "@/hooks/use-mobile"

interface UpdateDialogProps {
    updateInfo: UpdateInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface UpdateDownloadProgress {
    downloadId: string
    downloaded: number
    total?: number | null
    percent?: number | null
}

interface UpdateDownloadResult {
    path: string
    fileName: string
}

type DownloadStatus = "idle" | "downloading" | "completed" | "error"

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const getFileNameFromUrl = (url: string, fallback: string) => {
    try {
        const pathname = new URL(url).pathname
        const fileName = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "")
        return fileName || fallback
    } catch {
        return fallback
    }
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
    updateInfo,
    open,
    onOpenChange,
}) => {
    const isMobile = useIsMobile()
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle")
    const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgress | null>(null)
    const [downloadResult, setDownloadResult] = useState<UpdateDownloadResult | null>(null)
    const [downloadError, setDownloadError] = useState<string | null>(null)
    const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null)

    const downloadPercent = downloadProgress?.percent ?? null
    const downloadSizeText = downloadProgress
        ? downloadProgress.total
            ? `${formatBytes(downloadProgress.downloaded)} / ${formatBytes(downloadProgress.total)}`
            : formatBytes(downloadProgress.downloaded)
        : ""

    useEffect(() => {
        if (!open) {
            setDownloadStatus("idle")
            setDownloadProgress(null)
            setDownloadResult(null)
            setDownloadError(null)
            setActiveDownloadId(null)
        }
    }, [open])

    useEffect(() => {
        let disposed = false
        let unlisten: (() => void) | undefined

        listen<UpdateDownloadProgress>("update:download-progress", (event) => {
            setDownloadProgress((current) => {
                if (activeDownloadId && event.payload.downloadId !== activeDownloadId) {
                    return current
                }
                return event.payload
            })
        }).then((dispose) => {
            if (disposed) {
                dispose()
            } else {
                unlisten = dispose
            }
        })

        return () => {
            disposed = true
            unlisten?.()
        }
    }, [activeDownloadId])
    
    if (!updateInfo) return null

    const isForceUpdate = updateInfo.force_update

    const handleOpenChange = (newOpen: boolean) => {
        if (isForceUpdate) return
        onOpenChange(newOpen)
    }

    const downloads = updateInfo.platform_downloads || {}

    const getPlatformLabel = (key: string) => {
        const labels: Record<string, string> = {
            windows: "Windows 安装包",
            macos: "macOS 安装包",
            linux: "Linux 安装包",
            android: "Android 安装包",
        }
        return labels[key] || key
    }

    const getPlatformIcon = (key: string) => {
        switch (key) {
            case "windows": return <Monitor className="mr-2 h-4 w-4" />
            case "android": return <Smartphone className="mr-2 h-4 w-4" />
            case "macos": return <Apple className="mr-2 h-4 w-4" />
            default: return <Laptop className="mr-2 h-4 w-4" />
        }
    }

    const handleDownload = async (platform: string, url: string) => {
        const fileName = getFileNameFromUrl(url, `CyreneMusicNext-${updateInfo.version}-${platform}`)
        const downloadId = `${platform}-${Date.now()}`

        setActiveDownloadId(downloadId)
        setDownloadStatus("downloading")
        setDownloadProgress({ downloadId, downloaded: 0, total: null, percent: 0 })
        setDownloadResult(null)
        setDownloadError(null)

        try {
            const result = await invoke<UpdateDownloadResult>("download_update", {
                url,
                fileName,
                downloadId,
            })
            setDownloadResult(result)
            setDownloadStatus("completed")
        } catch (error) {
            console.error("[UpdateDialog] 下载安装包失败:", error)
            setDownloadError(error instanceof Error ? error.message : String(error))
            setDownloadStatus("error")
        }
    }

    const handleOpenDownloadedFile = async () => {
        if (!downloadResult?.path) return

        try {
            await openPath(downloadResult.path)
        } catch (error) {
            console.error("[UpdateDialog] 打开安装包失败:", error)
            setDownloadError(error instanceof Error ? error.message : String(error))
        }
    }

    const openExternalUrl = async (url?: string) => {
        if (!url) return

        try {
            await openUrl(url)
        } catch (error) {
            console.error("[UpdateDialog] 打开下载链接失败:", error)
            window.open(url, "_blank", "noopener,noreferrer")
        }
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

            <div className="flex flex-col gap-2 pt-2">
                {Object.keys(downloads).length > 0 ? (
                    <>
                        <div className="rounded-md bg-primary/5 p-3 border border-primary/10 text-xs text-muted-foreground mb-1">
                            <p>选择适合你平台的安装包直接下载：</p>
                        </div>
                        {Object.entries(downloads).map(([platform, url]) => (
                            <Button
                                key={platform}
                                className="w-full"
                                disabled={downloadStatus === "downloading"}
                                onClick={() => handleDownload(platform, url)}
                            >
                                {getPlatformIcon(platform)}
                                {getPlatformLabel(platform)}
                            </Button>
                        ))}
                    </>
                ) : (
                    <>
                        <div className="rounded-md bg-primary/5 p-3 border border-primary/10 text-xs text-muted-foreground">
                            <p>请点击下方按钮前往 GitHub Release 页面下载最新版本。</p>
                        </div>
                        <Button className="w-full" onClick={() => openExternalUrl(updateInfo.download_url)}>
                            <Download className="mr-2 h-4 w-4" />
                            前往 GitHub 下载
                        </Button>
                    </>
                )}
                {downloadStatus !== "idle" && (
                    <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span>
                                {downloadStatus === "downloading" && "正在下载"}
                                {downloadStatus === "completed" && "下载完成"}
                                {downloadStatus === "error" && "下载失败"}
                            </span>
                            {downloadPercent !== null && <span>{Math.min(100, Math.max(0, downloadPercent)).toFixed(1)}%</span>}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${downloadPercent !== null ? Math.min(100, Math.max(0, downloadPercent)) : 100}%` }}
                            />
                        </div>
                        {downloadSizeText && <p className="text-muted-foreground">{downloadSizeText}</p>}
                        {downloadResult && (
                            <p className="break-all text-muted-foreground">已保存：{downloadResult.fileName}</p>
                        )}
                        {downloadError && <p className="break-words text-destructive">{downloadError}</p>}
                        {downloadStatus === "completed" && (
                            <Button className="w-full" variant="secondary" onClick={handleOpenDownloadedFile}>
                                打开安装包
                            </Button>
                        )}
                    </div>
                )}
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
