"use client"

import { useRef, useState } from "react"
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
import { MusicPlatform, PLATFORM_CONFIG, playlistImportService } from "@/lib/services/playlistImportService"
import { Loader2, AlertCircle, FileJson, Upload } from "lucide-react"
import { AsyncImage } from "@/components/common/AsyncImage"
import { toast } from "sonner"

interface ImportPlaylistDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportSuccess?: () => void
}

type SourceMode = "platform" | "json"

interface PreviewData {
    id: string | number
    name: string
    creator: string
    coverImgUrl: string
    trackCount: number
    tracks: Array<{
        id: string | number
        name: string
        artists: string
        album: string
        picUrl?: string
        source: string
    }>
    /** 是 JSON 文件导入时为 true */
    fromJson?: boolean
}

const isTauriRuntime = (): boolean => {
    if (typeof window === "undefined") return false
    return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

const isAndroid = (): boolean => {
    return typeof window !== "undefined" && /Android/i.test(window.navigator.userAgent)
}

export function ImportPlaylistDialog({ open, onOpenChange, onImportSuccess }: ImportPlaylistDialogProps) {
    const [sourceMode, setSourceMode] = useState<SourceMode>("platform")
    const [platform, setPlatform] = useState<MusicPlatform>(MusicPlatform.netease)
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<"input" | "preview">("input")
    const [previewData, setPreviewData] = useState<PreviewData | null>(null)
    const [editedName, setEditedName] = useState("")
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const parseJsonText = (text: string): PreviewData | null => {
        try {
            const raw = JSON.parse(text)
            const pl = raw?.playlist || raw
            const tracksRaw: any[] = Array.isArray(raw?.tracks) ? raw.tracks : (Array.isArray(pl?.tracks) ? pl.tracks : [])
            if (!pl || !Array.isArray(tracksRaw)) return null

            const tracks = tracksRaw
                .map((t) => ({
                    id: t.id ?? t.trackId ?? t.track_id,
                    name: t.name || t.track_name || "",
                    artists: t.artists || "",
                    album: t.album || "",
                    picUrl: t.picUrl || t.pic_url || "",
                    source: t.source || pl.source || "netease",
                }))
                .filter((t) => t.id !== undefined && t.id !== null && String(t.id).length > 0 && t.name)

            return {
                id: pl.id ?? "",
                name: pl.name || "未命名歌单",
                creator: pl.creator || "",
                coverImgUrl: pl.coverImgUrl || pl.coverUrl || "",
                trackCount: tracks.length,
                tracks,
                fromJson: true,
            }
        } catch (e) {
            return null
        }
    }

    const handleJsonFromText = (text: string) => {
        const data = parseJsonText(text)
        if (!data) {
            toast.error("JSON 格式不正确，无法解析为歌单数据")
            return
        }
        if (data.tracks.length === 0) {
            toast.error("JSON 中未检测到有效的歌曲列表")
            return
        }
        setPreviewData(data)
        setEditedName(data.name)
        setStep("preview")
    }

    const handlePickJsonFile = async () => {
        if (isTauriRuntime() && !isAndroid()) {
            try {
                const { open: openDialog } = await import("@tauri-apps/plugin-dialog")
                const { readTextFile } = await import("@tauri-apps/plugin-fs")
                const filePath = await openDialog({
                    multiple: false,
                    filters: [{ name: "JSON", extensions: ["json"] }],
                })
                if (!filePath || Array.isArray(filePath)) return
                const text = await readTextFile(filePath as string)
                handleJsonFromText(text)
            } catch (e) {
                console.error("[ImportPlaylistDialog] read json failed:", e)
                toast.error("读取 JSON 文件失败")
            }
        } else {
            fileInputRef.current?.click()
        }
    }

    const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return
        try {
            const text = await file.text()
            handleJsonFromText(text)
        } catch (err) {
            toast.error("读取 JSON 文件失败")
        }
    }

    const handleNext = async () => {
        if (sourceMode === "json") {
            // JSON 模式没有 next 步骤
            return
        }
        const id = playlistImportService.parsePlaylistId(platform, url)
        if (!id) {
            toast.error("解析 URL 或 ID 失败，请检查输入格式")
            return
        }

        setLoading(true)
        try {
            const data = await playlistImportService.fetchExternalPlaylist(platform, id)
            if (data) {
                setPreviewData(data as PreviewData)
                setEditedName(data.name)
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
        const finalName = editedName.trim() || previewData.name
        if (!finalName) {
            toast.error("歌单名不能为空")
            return
        }

        setLoading(true)
        try {
            const { playlistService } = await import("@/lib/services/playlistService")
            const createOptions = previewData.fromJson
                ? undefined
                : { source: platform, sourcePlaylistId: String(previewData.id) }
            const newPlaylist = await playlistService.createPlaylist(finalName, createOptions)

            if (!newPlaylist) {
                toast.error("创建歌单失败")
                return
            }

            const tracksToAdd = previewData.tracks.map((t) => ({
                trackId: String(t.id),
                name: t.name,
                artists: t.artists,
                album: t.album,
                picUrl: t.picUrl || "",
                source: t.source,
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
        setEditedName("")
        setUrl("")
        setSourceMode("platform")
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
                        从第三方音乐平台或本地 JSON 备份导入歌单到 Cyrene Music
                    </DialogDescription>
                </DialogHeader>

                {step === "input" ? (
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>导入来源</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant={sourceMode === "platform" ? "default" : "outline"}
                                    className="h-10"
                                    onClick={() => setSourceMode("platform")}
                                >
                                    <span className="text-xs">第三方平台</span>
                                </Button>
                                <Button
                                    variant={sourceMode === "json" ? "default" : "outline"}
                                    className="h-10 gap-1.5"
                                    onClick={() => setSourceMode("json")}
                                >
                                    <FileJson className="w-3.5 h-3.5" />
                                    <span className="text-xs">JSON 文件</span>
                                </Button>
                            </div>
                        </div>

                        {sourceMode === "platform" ? (
                            <>
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
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label>选择 JSON 文件</Label>
                                <button
                                    type="button"
                                    onClick={handlePickJsonFile}
                                    className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                                >
                                    <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                                        点击选择从本应用导出的歌单 JSON 文件
                                    </span>
                                </button>
                                {(!isTauriRuntime() || isAndroid()) && (
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="application/json,.json"
                                        className="hidden"
                                        onChange={handleWebFileChange}
                                    />
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    仅支持本应用「导出歌单」功能生成的 JSON 文件
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {previewData && (
                            <>
                                <div className="flex gap-4 p-4 rounded-xl bg-accent/5 border border-accent/10">
                                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                                        {previewData.coverImgUrl ? (
                                            <AsyncImage src={previewData.coverImgUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <FileJson className="w-8 h-8 text-muted-foreground/50" />
                                        )}
                                    </div>
                                    <div className="space-y-1 py-1 min-w-0 flex-1">
                                        <p className="text-xs text-muted-foreground truncate">
                                            原名：{previewData.name}
                                        </p>
                                        {previewData.creator && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                创建者：{previewData.creator}
                                            </p>
                                        )}
                                        <p className="text-xs font-medium text-primary mt-1">
                                            {previewData.trackCount} 首歌曲
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="playlist-name">歌单名</Label>
                                    <Input
                                        id="playlist-name"
                                        value={editedName}
                                        onChange={(e) => setEditedName(e.target.value)}
                                        placeholder="输入歌单名"
                                        maxLength={80}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        可在此修改导入后的歌单名
                                    </p>
                                </div>
                            </>
                        )}
                        <div className="flex items-center gap-2 p-3 text-[12px] bg-primary/5 text-primary rounded-lg border border-primary/10">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>点击「确认导入」后将创建新歌单并写入歌曲</span>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === "input" ? (
                        sourceMode === "platform" ? (
                            <Button onClick={handleNext} disabled={loading || !url.trim()} className="w-full">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                下一步
                            </Button>
                        ) : null
                    ) : (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={() => setStep("input")} disabled={loading} className="flex-1">
                                返回修改
                            </Button>
                            <Button onClick={handleImport} disabled={loading || !editedName.trim()} className="flex-1">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                确认导入
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}