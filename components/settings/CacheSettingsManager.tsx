"use client"

import { useEffect, useState } from "react"
import { HardDrive, FolderOpen, Trash2, ShieldCheck, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCacheStore } from "@/lib/store/useCacheStore"
import { cacheService } from "@/lib/services/cacheService"
import { open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { isAndroidTauriRuntime } from "@/lib/services/androidMediaNotificationService"

export function CacheSettingsManager() {
    const { isCacheEnabled, setIsCacheEnabled, cacheDirectory, setCacheDirectory } = useCacheStore()
    const [mounted, setMounted] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [cacheSize, setCacheSize] = useState<number>(0)
    const [actualCacheDir, setActualCacheDir] = useState<string>("")
    const [isCalculating, setIsCalculating] = useState(false)
    const [isClearing, setIsClearing] = useState(false)

    useEffect(() => {
        setMounted(true)
        setIsMobile(isAndroidTauriRuntime() || window.innerWidth < 768)
        loadCacheInfo()
    }, [])

    const loadCacheInfo = async () => {
        setIsCalculating(true)
        try {
            const dir = await cacheService.getCacheDir()
            setActualCacheDir(dir)
            const size = await cacheService.calculateCacheSize()
            setCacheSize(size)
        } catch (e) {
            console.error("Failed to load cache info", e)
        } finally {
            setIsCalculating(false)
        }
    }

    const handleSelectDirectory = async () => {
        if (isMobile) {
            toast.info("移动端使用默认系统缓存目录，不支持自定义")
            return
        }

        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "选择缓存存储目录"
            })
            
            if (selected === null) {
                // User cancelled
                return
            }
            
            // `open` returns string | string[] depending on multiple
            const newDir = Array.isArray(selected) ? selected[0] : selected
            if (newDir) {
                setCacheDirectory(newDir)
                toast.success("缓存目录已更新")
                loadCacheInfo()
            }
        } catch (error) {
            console.error("Select directory failed:", error)
            toast.error("选择目录失败")
        }
    }

    const handleClearCache = async () => {
        setIsClearing(true)
        try {
            await cacheService.clearCache()
            toast.success("缓存已清空")
            await loadCacheInfo()
        } catch (e) {
            toast.error("清理缓存失败")
        } finally {
            setIsClearing(false)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    if (!mounted) {
        return <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
        </div>
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle>歌曲缓存</CardTitle>
                <CardDescription>
                    缓存播放过的歌曲以节省流量，并在离线时提供可用性。缓存的音频受本地加密保护 (.cyrene)。
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
                <div className="flex items-center justify-between p-4 rounded-xl border border-muted bg-popover/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">本地音频缓存</Label>
                            <p className="text-sm text-muted-foreground">
                                开启后优先从本地加载已缓存歌曲，文件自动使用异或加密。
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={isCacheEnabled}
                        onCheckedChange={setIsCacheEnabled}
                    />
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">缓存位置与统计</h3>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 p-4 rounded-xl border border-muted bg-popover/30 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">当前存储路径</span>
                                </div>
                                {!isMobile && (
                                    <Button variant="outline" size="sm" onClick={handleSelectDirectory} className="h-7 text-xs">
                                        更改目录
                                    </Button>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground break-all bg-muted/50 p-2 rounded">
                                {actualCacheDir || "正在获取目录..."}
                            </div>
                        </div>

                        <div className="md:w-64 p-4 rounded-xl border border-muted bg-popover/30 space-y-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">空间占用</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={loadCacheInfo} disabled={isCalculating} className="h-6 w-6">
                                    <RefreshCw className={`h-3 w-3 ${isCalculating ? "animate-spin" : ""}`} />
                                </Button>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold text-primary">
                                    {isCalculating ? "..." : formatSize(cacheSize)}
                                </span>
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={handleClearCache} 
                                    disabled={isClearing || cacheSize === 0}
                                    className="h-7 text-xs"
                                >
                                    <Trash2 className="h-3 w-3 mr-1" /> 清理
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
