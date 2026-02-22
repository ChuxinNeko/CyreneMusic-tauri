"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MusicPlatform, PLATFORM_CONFIG, playlistImportService } from "@/lib/services/playlistImportService"
import { Loader2, Music2, AlertCircle } from "lucide-react"
import { AsyncImage } from "@/components/common/AsyncImage"
import { toast } from "sonner"

interface ImportPlaylistDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportSuccess?: () => void
}

export function ImportPlaylistDialog({ open, onOpenChange, onImportSuccess }: ImportPlaylistDialogProps) {
    const [platform, setPlatform] = useState<MusicPlatform>(MusicPlatform.netease)
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<"input" | "preview">("input")
    const [previewData, setPreviewData] = useState<any>(null)

    const handleNext = async () => {
        const id = playlistImportService.parsePlaylistId(platform, url)
        if (!id) {
            toast.error("解析 URL 或 ID 失败，请检查输入格式")
            return
        }

        setLoading(true)
        try {
            const data = await playlistImportService.fetchExternalPlaylist(platform, id)
            if (data) {
                setPreviewData(data)
                setStep("preview")
            } else {
                toast.error("获取歌单信息失败，请检查 ID 或 URL 是否正确")
            }
        } catch (e) {
            toast.error("请求出错，请稍后再试")
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        if (!previewData) return

        setLoading(true)
        try {
            // First select/create a target playlist. For now, we create a new one named after the source.
            // In a full implementation, we might want to let the user select an existing one.
            const { playlistService } = await import("@/lib/services/playlistService")
            const newPlaylist = await playlistService.createPlaylist(previewData.name)

            if (!newPlaylist) {
                toast.error("创建歌单失败")
                return
            }

            const tracksToAdd = previewData.tracks.map((t: any) => ({
                trackId: String(t.id),
                name: t.name,
                artists: t.artists,
                album: t.album,
                picUrl: t.picUrl,
                source: t.source
            }))

            const success = await playlistService.addTracksToPlaylist(newPlaylist.id, tracksToAdd)

            if (success) {
                toast.success(`成功导入 ${tracksToAdd.length} 首歌曲到新歌单「${newPlaylist.name}」`)
                onImportSuccess?.()
                onOpenChange(false)
            } else {
                toast.error("导入歌曲失败")
            }
        } catch (e) {
            toast.error("导入过程中出错")
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setStep("input")
        setPreviewData(null)
        setUrl("")
    }

    return (
        <Dialog open={open} onOpenChange={(v) => {
            onOpenChange(v)
            if (!v) reset()
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>导入歌单</DialogTitle>
                    <DialogDescription>
                        从第三方音乐平台导入你的歌单到 Cyrene Music
                    </DialogDescription>
                </DialogHeader>

                {step === "input" ? (
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>选择平台</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(MusicPlatform) as Array<keyof typeof MusicPlatform>).map((key) => (
                                    <Button
                                        key={key}
                                        variant={platform === MusicPlatform[key] ? "default" : "outline"}
                                        className="h-10 px-2"
                                        onClick={() => setPlatform(MusicPlatform[key])}
                                    >
                                        <span className="mr-2">{PLATFORM_CONFIG[MusicPlatform[key]].icon}</span>
                                        <span className="text-xs">{PLATFORM_CONFIG[MusicPlatform[key]].name}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="url">歌单 URL 或 ID</Label>
                            <Input
                                id="url"
                                placeholder="粘贴歌单链接或直接输入 ID"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                支持网易云、QQ音乐等平台的歌单链接
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {previewData && (
                            <div className="flex gap-4 p-4 rounded-xl bg-accent/5 border border-accent/10">
                                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                                    <AsyncImage src={previewData.coverImgUrl} className="w-full h-full object-cover" />
                                </div>
                                <div className="space-y-1 py-1">
                                    <h4 className="font-bold text-sm line-clamp-2">{previewData.name}</h4>
                                    <p className="text-xs text-muted-foreground">{previewData.creator}</p>
                                    <p className="text-xs font-medium text-primary mt-1">{previewData.trackCount} 首歌曲</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 p-3 text-[12px] bg-primary/5 text-primary rounded-lg border border-primary/10">
                            <AlertCircle className="w-4 h-4" />
                            <span>点击“确认导入”后将开始抓取歌曲信息并保存至你的本地歌单</span>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === "input" ? (
                        <Button onClick={handleNext} disabled={loading || !url.trim()} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            下一步
                        </Button>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={() => setStep("input")} className="flex-1">
                                返回修改
                            </Button>
                            <Button onClick={handleImport} className="flex-1">
                                确认导入
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
