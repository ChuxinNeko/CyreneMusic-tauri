
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

interface AndroidInstallResult {
    success: boolean
    errorCode: string
    message: string
    needsPermission: boolean
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
    const [showAllPlatforms, setShowAllPlatforms] = useState(false)
    const [showInstallDialog, setShowInstallDialog] = useState(false)

    const downloadPercent = downloadProgress?.percent ?? null
    const downloadSizeText = downloadProgress
        ? downloadProgress.total
            ? `${formatBytes(downloadProgress.downloaded)} / ${formatBytes(downloadProgress.total)}`
            : formatBytes(downloadProgress.downloaded)
        : ""

    useEffect(() => {
        if (!open && !showInstallDialog) {
            setDownloadStatus("idle")
            setDownloadProgress(null)
            setDownloadResult(null)
            setDownloadError(null)
            setActiveDownloadId(null)
            setShowAllPlatforms(false)
        }
    }, [open, showInstallDialog])

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
    
    const downloads = updateInfo?.platform_downloads || {}

    const displayedDownloads = React.useMemo(() => {
        if (!isMobile || showAllPlatforms) return downloads;
        
        // 移动端默认优先且仅展示移动端包 (android, ios)
        const mobileKeys = ["android", "ios"];
        const filtered: Record<string, string> = {};
        let hasMobilePackage = false;
        
        for (const key of mobileKeys) {
            if (downloads[key]) {
                filtered[key] = downloads[key];
                hasMobilePackage = true;
            }
        }
        
        return hasMobilePackage ? filtered : downloads;
    }, [downloads, isMobile, showAllPlatforms]);

    const hasHiddenDesktopDownloads = React.useMemo(() => {
        if (!isMobile || showAllPlatforms) return false;
        const desktopKeys = ["windows", "macos", "linux"];
        return desktopKeys.some(key => !!downloads[key]);
    }, [downloads, isMobile, showAllPlatforms]);

    if (!updateInfo) return null

    const isForceUpdate = updateInfo.force_update

    const handleOpenChange = (newOpen: boolean) => {
        if (isForceUpdate) return
        onOpenChange(newOpen)
    }

    const getPlatformLabel = (key: string) => {
        const labels: Record<string, string> = {
            windows: "Windows 安装包",
            macos: "macOS 安装包",
            linux: "Linux 安装包",
            android: "Android 安装包",
            ios: "iOS (IPA) 安装包",
        }
        return labels[key] || key
    }

    const getPlatformIcon = (key: string) => {
        switch (key) {
            case "windows": return <Monitor className="mr-2 h-4 w-4" />
            case "android": return <Smartphone className="mr-2 h-4 w-4" />
            case "macos": return <Apple className="mr-2 h-4 w-4" />
            case "ios": return <Smartphone className="mr-2 h-4 w-4" />
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

        // 立即关闭主弹窗并展示独立状态弹窗
        onOpenChange(false)
        setShowInstallDialog(true)

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
            if (downloadResult.fileName.toLowerCase().endsWith('.apk') || activeDownloadId?.startsWith('android')) {
                const result = await invoke<AndroidInstallResult>("android_install_apk", { filePath: downloadResult.path })

                if (result.success) return

                const hint = result.needsPermission
                    ? `需要「安装未知来源应用」权限。已为您打开系统设置，请授权后返回应用，安装将自动继续。`
                    : (result.message || "安装失败")
                setDownloadError(hint)
                setDownloadStatus("error")
                return
            }

            await openPath(downloadResult.path)
        } catch (error) {
            if (String(error).includes("Not supported")) {
                await openPath(downloadResult.path)
                return
            }
            console.error("[UpdateDialog] 打开安装包失败:", error)
            setDownloadError(error instanceof Error ? error.message : String(error))
            setDownloadStatus("error")
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
                <h4 className="text-sm font-medium leading-none text-muted-foreground">更新记录</h4>
                <ScrollArea className={`${isMobile ? 'h-[130px]' : 'h-[150px]'} w-full rounded-xl border p-4 bg-muted/30 backdrop-blur-sm transition-all`}>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                        {updateInfo.changelog || "作者暂未提供详细更新记录。"}
                    </div>
                </ScrollArea>
            </div>

            {isForceUpdate && (
                <div className="flex items-start gap-3 rounded-xl bg-destructive/5 dark:bg-destructive/10 p-3.5 border border-destructive/20 text-destructive text-sm backdrop-blur-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                        <p className="font-semibold text-xs leading-none mb-0.5">强制更新提示</p>
                        <p className="text-[11px] opacity-85 leading-normal">此版本包含关键更新，必须升级后才能继续使用应用。</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
                {Object.keys(displayedDownloads).length > 0 ? (
                    <>
                        <div className="rounded-lg bg-primary/5 p-3 border border-primary/10 text-xs text-muted-foreground/90 mb-1 leading-normal">
                            <p>{isMobile ? "已为您筛选适合移动端的安装包直接下载：" : "选择适合你平台的安装包直接下载："}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            {Object.entries(displayedDownloads).map(([platform, url]) => (
                                <Button
                                    key={platform}
                                    className="w-full rounded-xl py-5 font-medium transition-all shadow-sm active:scale-[0.98]"
                                    disabled={downloadStatus === "downloading"}
                                    onClick={() => handleDownload(platform, url)}
                                >
                                    {getPlatformIcon(platform)}
                                    {getPlatformLabel(platform)}
                                </Button>
                            ))}
                        </div>

                        {hasHiddenDesktopDownloads && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs text-muted-foreground/80 w-full hover:bg-muted/50 transition-colors py-2 h-auto flex items-center justify-center gap-1.5 mt-0.5 rounded-lg font-medium"
                                onClick={() => setShowAllPlatforms(true)}
                            >
                                <span>🌐</span> 显示桌面端安装包 (Windows/macOS/Linux)
                            </Button>
                        )}

                        {downloads.ios && (
                            <div className="rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 backdrop-blur-md p-3.5 text-xs text-amber-600 dark:text-amber-400 mt-2 shadow-sm transition-all duration-300">
                                <div className="flex items-center gap-1.5 font-semibold mb-1">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">💡</span>
                                    <span>iOS 安装与自签说明</span>
                                </div>
                                <p className="opacity-90 leading-relaxed text-[11px] pl-6">
                                    此安装包为<strong>未签名版</strong>。下载后可直接通过<strong>巨魔 (TrollStore)</strong> 导入安装；或借助电脑使用 <strong>AltStore</strong> 或 <strong>Sideloadly</strong> 进行个人免费证书自签导入。
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="rounded-lg bg-primary/5 p-3 border border-primary/10 text-xs text-muted-foreground/90 leading-normal">
                            <p>请点击下方按钮前往 GitHub Release 页面下载最新版本。</p>
                        </div>
                        <Button className="w-full rounded-xl py-5" onClick={() => openExternalUrl(updateInfo.download_url)}>
                            <Download className="mr-2 h-4 w-4" />
                            前往 GitHub 下载
                        </Button>
                    </>
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

    const handleInstallOpenChange = (newOpen: boolean) => {
        setShowInstallDialog(newOpen)
        if (!newOpen && !open) {
            setDownloadStatus("idle")
            setDownloadProgress(null)
            setDownloadResult(null)
            setDownloadError(null)
            setActiveDownloadId(null)
            setShowAllPlatforms(false)
        }
    }

    const InstallContent = (() => {
        if (downloadStatus === "downloading") {
            return (
                <div className="flex flex-col items-center text-center gap-5 py-4">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-download animate-bounce"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                    </div>
                    
                    <div className="space-y-1.5 w-full">
                        <h3 className="text-base font-bold tracking-tight text-foreground">正在下载更新包...</h3>
                        <p className="text-xs text-muted-foreground leading-normal">
                            正在获取新版本 <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground text-[10.5px]">v{updateInfo?.version}</span>，请稍候。
                        </p>
                    </div>

                    <div className="w-full space-y-2.5 rounded-xl border bg-muted/20 backdrop-blur-sm p-4 text-xs text-left leading-normal">
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                            <span className="font-medium">下载进度</span>
                            {downloadPercent !== null && <span className="font-mono text-foreground font-semibold">{Math.min(100, Math.max(0, downloadPercent)).toFixed(0)}%</span>}
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/50 w-full">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${downloadPercent !== null ? Math.min(100, Math.max(0, downloadPercent)) : 100}%` }}
                            />
                        </div>
                        {downloadSizeText && (
                            <p className="text-muted-foreground/80 font-mono text-[10px] text-right mt-1">{downloadSizeText}</p>
                        )}
                    </div>

                    <Button 
                        variant="outline" 
                        className="w-full rounded-xl text-xs text-muted-foreground" 
                        onClick={() => handleInstallOpenChange(false)}
                    >
                        在后台下载
                    </Button>
                </div>
            )
        }

        if (downloadStatus === "error") {
            return (
                <div className="flex flex-col items-center text-center gap-5 py-4">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="26"
                            height="26"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-x-circle"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="m15 9-6 6" />
                            <path d="m9 9 6 6" />
                        </svg>
                    </div>
                    
                    <div className="space-y-1.5 w-full">
                        <h3 className="text-base font-bold tracking-tight text-foreground">下载更新包失败</h3>
                        <p className="text-xs text-muted-foreground leading-normal px-4">
                            在下载新版本 <span className="font-semibold">v{updateInfo?.version}</span> 时遇到了未知错误。
                        </p>
                    </div>

                    {downloadError && (
                        <div className="w-full text-left rounded-xl bg-destructive/5 border border-destructive/10 p-3 text-[11px] text-destructive leading-relaxed max-h-[80px] overflow-y-auto">
                            <p className="font-semibold mb-0.5">错误详情：</p>
                            <p className="font-mono text-[10px] opacity-90 break-all">{downloadError}</p>
                        </div>
                    )}

                    <div className="flex flex-col w-full gap-2 pt-1">
                        <Button 
                            className="w-full rounded-xl py-5 font-semibold text-xs shadow-sm active:scale-[0.98]" 
                            onClick={() => {
                                handleInstallOpenChange(false)
                                onOpenChange(true)
                            }}
                        >
                            返回重试
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full rounded-xl text-xs text-muted-foreground" 
                            onClick={() => handleInstallOpenChange(false)}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            )
        }

        // 默认 completed 状态
        return (
            <div className="flex flex-col items-center text-center gap-5 py-2">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-package-check animate-pulse"
                    >
                        <path d="m16 16 2 2 4-4" />
                        <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
                        <path d="M12 22V12" />
                        <path d="m12 12 8.73-5.04" />
                        <path d="m12 12-8.73-5.04" />
                        <path d="M20 12.3v.7" />
                    </svg>
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                </div>
                
                <div className="space-y-1.5">
                    <h3 className="text-base font-bold tracking-tight text-foreground">更新包已准备就绪</h3>
                    <p className="text-xs text-muted-foreground leading-normal px-2">
                        新版本 <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground text-[10.5px]">v{updateInfo?.version}</span> 已成功下载到本地。
                    </p>
                </div>

                {downloadResult && (
                    <div className="w-full text-left rounded-xl bg-muted/40 border border-muted/50 p-3 text-[11px] space-y-1 leading-normal">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-muted-foreground shrink-0">文件名称：</span>
                            <span className="font-medium text-foreground break-all text-right">{downloadResult.fileName}</span>
                        </div>
                        {!isMobile && downloadResult.path && (
                            <div className="flex items-start justify-between gap-2 pt-1 border-t border-muted/50">
                                <span className="text-muted-foreground shrink-0">存放目录：</span>
                                <span className="font-mono text-[9.5px] text-muted-foreground break-all text-right">{downloadResult.path.replace(/[^\\]+$/, '')}</span>
                            </div>
                        )}
                    </div>
                )}

                {downloadResult?.fileName.toLowerCase().endsWith('.ipa') && (
                    <div className="rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 backdrop-blur-md p-3 text-xs text-amber-600 dark:text-amber-400 text-left w-full leading-normal">
                        <p className="font-semibold mb-0.5 flex items-center gap-1"><span role="img" aria-label="alert">🔔</span> iOS 安装指引：</p>
                        <p className="opacity-90 text-[10px]">
                            请打开已安装的<strong>巨魔 (TrollStore)</strong> 导入此包；或将其投递至电脑使用自签工具安装。
                        </p>
                    </div>
                )}

                <div className="flex flex-col w-full gap-2 pt-1">
                    <Button className="w-full rounded-xl py-5 font-semibold text-xs shadow-sm active:scale-[0.98]" onClick={handleOpenDownloadedFile}>
                        立即安装更新
                    </Button>
                    <Button variant="outline" className="w-full rounded-xl text-xs text-muted-foreground" onClick={() => handleInstallOpenChange(false)}>
                        稍后手动安装
                    </Button>
                </div>
            </div>
        )
    })()

    if (isMobile) {
        return (
            <>
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

                <Sheet open={showInstallDialog} onOpenChange={handleInstallOpenChange}>
                    <SheetContent 
                        side="bottom" 
                        className="rounded-t-[20px] px-6 pb-8 pt-4"
                        showCloseButton={true}
                    >
                        <div className="mx-auto mt-1 h-1.5 w-12 rounded-full bg-muted mb-4" />
                        {InstallContent}
                    </SheetContent>
                </Sheet>
            </>
        )
    }

    return (
        <>
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

            <Dialog open={showInstallDialog} onOpenChange={handleInstallOpenChange}>
                <DialogContent 
                    className="sm:max-w-[360px] p-6 rounded-2xl border bg-background/85 backdrop-blur-md shadow-2xl"
                    showCloseButton={true}
                >
                    {InstallContent}
                </DialogContent>
            </Dialog>
        </>
    )
}
