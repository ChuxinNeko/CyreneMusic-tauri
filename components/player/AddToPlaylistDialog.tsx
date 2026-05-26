"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Loader2, Music, Check, ListMusic, Minus, X } from "lucide-react"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist } from "@/lib/models/playlist"
import { Track } from "@/lib/models/track"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface AddToPlaylistDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    track: Track | null
    onStatusChange?: () => void
    /**
     * 仅作为初始视图过滤提示：
     * - 'remove': 默认仅展示该歌曲所在的歌单（仍可手动展开全部）
     * - 其他：展示全部歌单
     * 行为统一为「批量编辑归属」，不再有即点即生效的旧逻辑。
     */
    mode?: "add" | "remove"
}

type RowState = "kept" | "willAdd" | "willRemove" | "idle"

const computeRowState = (
    playlistId: number,
    inPlaylistIds: number[],
    selectedIds: number[],
): RowState => {
    const wasIn = inPlaylistIds.includes(playlistId)
    const isSelected = selectedIds.includes(playlistId)
    if (wasIn && isSelected) return "kept"
    if (wasIn && !isSelected) return "willRemove"
    if (!wasIn && isSelected) return "willAdd"
    return "idle"
}

export function AddToPlaylistDialog({
    open,
    onOpenChange,
    track,
    onStatusChange,
    mode = "add",
}: AddToPlaylistDialogProps) {
    const isMobile = useIsMobile()

    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [inPlaylistIds, setInPlaylistIds] = useState<number[]>([])
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    const [isCreating, setIsCreating] = useState(false)
    const [newPlaylistName, setNewPlaylistName] = useState("")
    const [creatingPlaylist, setCreatingPlaylist] = useState(false)

    const [showOnlyJoined, setShowOnlyJoined] = useState(false)

    const fetchStatus = useCallback(async () => {
        if (!track) return
        setLoading(true)
        try {
            const [playlistsData, status] = await Promise.all([
                playlistService.getPlaylists(),
                playlistService.checkTrackInPlaylists(track.id, track.source),
            ])
            setPlaylists(playlistsData)
            setInPlaylistIds(status.playlistIds)
            setSelectedIds(status.playlistIds)
        } catch {
            toast.error("获取歌单信息失败")
        } finally {
            setLoading(false)
        }
    }, [track])

    useEffect(() => {
        if (open && track) {
            fetchStatus()
            setShowOnlyJoined(mode === "remove")
            setIsCreating(false)
            setNewPlaylistName("")
        }
    }, [open, track, mode, fetchStatus])

    const toggleSelect = (playlistId: number) => {
        if (saving) return
        setSelectedIds((prev) =>
            prev.includes(playlistId)
                ? prev.filter((id) => id !== playlistId)
                : [...prev, playlistId],
        )
    }

    const visiblePlaylists = useMemo(() => {
        if (!showOnlyJoined) return playlists
        return playlists.filter(
            (p) => inPlaylistIds.includes(p.id) || selectedIds.includes(p.id),
        )
    }, [playlists, inPlaylistIds, selectedIds, showOnlyJoined])

    const toAdd = useMemo(
        () => selectedIds.filter((id) => !inPlaylistIds.includes(id)),
        [selectedIds, inPlaylistIds],
    )
    const toRemove = useMemo(
        () => inPlaylistIds.filter((id) => !selectedIds.includes(id)),
        [inPlaylistIds, selectedIds],
    )
    const hasChanges = toAdd.length > 0 || toRemove.length > 0

    const hiddenJoinedCount = useMemo(() => {
        if (showOnlyJoined) return 0
        return 0
    }, [showOnlyJoined])

    const desktopHasUnjoined = useMemo(
        () => playlists.some((p) => !inPlaylistIds.includes(p.id) && !selectedIds.includes(p.id)),
        [playlists, inPlaylistIds, selectedIds],
    )

    const handleCreatePlaylist = async () => {
        const name = newPlaylistName.trim()
        if (!name || !track) return
        setCreatingPlaylist(true)
        try {
            const newPlaylist = await playlistService.createPlaylist(name)
            if (!newPlaylist) {
                toast.error("创建歌单失败")
                return
            }
            setPlaylists((prev) => [newPlaylist, ...prev])
            setSelectedIds((prev) =>
                prev.includes(newPlaylist.id) ? prev : [...prev, newPlaylist.id],
            )
            setNewPlaylistName("")
            setIsCreating(false)
            toast.success(`已创建歌单「${name}」，保存后将自动加入`)
        } catch {
            toast.error("创建失败")
        } finally {
            setCreatingPlaylist(false)
        }
    }

    const handleSave = async () => {
        if (!track || !hasChanges) {
            onOpenChange(false)
            return
        }

        setSaving(true)
        let addedOk = 0
        let removedOk = 0
        let failed = 0

        try {
            for (const playlistId of toAdd) {
                const ok = await playlistService.addTrackToPlaylist(
                    playlistId,
                    track.id,
                    track.name,
                    track.artists,
                    track.album || "",
                    track.picUrl || "",
                    track.source,
                )
                if (ok) addedOk++
                else failed++
            }

            for (const playlistId of toRemove) {
                const ok = await playlistService.removeTrackFromPlaylist(
                    playlistId,
                    track.id,
                    track.source,
                )
                if (ok) removedOk++
                else failed++
            }

            const parts: string[] = []
            if (addedOk > 0) parts.push(`添加 ${addedOk}`)
            if (removedOk > 0) parts.push(`移除 ${removedOk}`)

            if (parts.length > 0) {
                toast.success(parts.join(" · "))
            }
            if (failed > 0) {
                toast.error(`${failed} 项操作失败`)
            }

            onStatusChange?.()
            onOpenChange(false)
        } catch {
            toast.error("保存失败")
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        if (saving || creatingPlaylist) return
        onOpenChange(false)
    }

    const renderRow = (playlist: Playlist) => {
        const state = computeRowState(playlist.id, inPlaylistIds, selectedIds)

        const containerClass = cn(
            "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border select-none",
            state === "kept" &&
                "bg-primary/10 border-primary/20 hover:bg-primary/15",
            state === "willAdd" &&
                "bg-primary/10 border-primary/30 hover:bg-primary/15 ring-1 ring-primary/20",
            state === "willRemove" &&
                "bg-destructive/5 border-destructive/30 hover:bg-destructive/10",
            state === "idle" &&
                "bg-secondary/40 border-transparent hover:bg-secondary/60 hover:border-border/50",
        )

        const titleClass = cn(
            "text-[15px] font-bold truncate",
            state === "kept" && "text-primary",
            state === "willAdd" && "text-primary",
            state === "willRemove" && "text-destructive line-through opacity-80",
        )

        return (
            <div
                key={playlist.id}
                onClick={() => toggleSelect(playlist.id)}
                className={containerClass}
                role="button"
                aria-pressed={selectedIds.includes(playlist.id)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {playlist.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={playlist.coverUrl}
                                className="w-full h-full object-cover"
                                alt=""
                            />
                        ) : (
                            <Music className="w-5 h-5 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className={titleClass}>{playlist.name}</span>
                        <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                            <span>{playlist.trackCount} 首</span>
                            {state === "willAdd" && (
                                <span className="text-primary font-medium">· 待添加</span>
                            )}
                            {state === "willRemove" && (
                                <span className="text-destructive font-medium">· 待移除</span>
                            )}
                        </span>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {state === "kept" && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                    )}
                    {state === "willAdd" && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                    )}
                    {state === "willRemove" && (
                        <div className="w-5 h-5 rounded-full bg-destructive/15 border border-destructive/40 flex items-center justify-center">
                            <Minus className="w-3.5 h-3.5 text-destructive" />
                        </div>
                    )}
                    {state === "idle" && (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center group-hover:border-foreground/60 transition-colors" />
                    )}
                </div>
            </div>
        )
    }

    const ListSection = (
        <div className="flex flex-col min-h-0">
            {/* 创建歌单入口 */}
            <div className="px-1 pb-2">
                {isCreating ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/40">
                        <Input
                            placeholder="输入新歌单名称"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            className="h-9 flex-1"
                            autoFocus
                            disabled={creatingPlaylist}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreatePlaylist()
                                if (e.key === "Escape") {
                                    setIsCreating(false)
                                    setNewPlaylistName("")
                                }
                            }}
                        />
                        <Button
                            size="sm"
                            onClick={handleCreatePlaylist}
                            disabled={!newPlaylistName.trim() || creatingPlaylist}
                            className="h-9"
                        >
                            {creatingPlaylist ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "创建"
                            )}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setIsCreating(false)
                                setNewPlaylistName("")
                            }}
                            disabled={creatingPlaylist}
                            className="h-9 px-2"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>新建歌单</span>
                    </button>
                )}
            </div>

            <ScrollArea className={cn(isMobile ? "h-[50vh]" : "h-[320px]", "pr-3")}>
                {loading && playlists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">加载歌单中...</span>
                    </div>
                ) : visiblePlaylists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                        <ListMusic className="w-7 h-7 opacity-50" />
                        <span>{showOnlyJoined ? "该歌曲未在任何歌单中" : "暂无歌单"}</span>
                    </div>
                ) : (
                    <div className="space-y-2 px-1 pb-1">
                        {visiblePlaylists.map(renderRow)}
                        {showOnlyJoined && desktopHasUnjoined && (
                            <button
                                type="button"
                                onClick={() => setShowOnlyJoined(false)}
                                className="w-full text-xs text-muted-foreground/80 hover:text-foreground transition-colors py-2 mt-1"
                            >
                                显示全部歌单
                            </button>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    )

    const SummaryBar = (
        <div
            className={cn(
                "flex items-center justify-between text-[12px] px-1 py-1",
                hasChanges ? "text-foreground" : "text-muted-foreground",
            )}
        >
            <div className="flex items-center gap-2">
                {toAdd.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-primary font-medium">
                        <Plus className="w-3.5 h-3.5" />
                        添加 {toAdd.length}
                    </span>
                )}
                {toRemove.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-destructive font-medium">
                        <Minus className="w-3.5 h-3.5" />
                        移除 {toRemove.length}
                    </span>
                )}
                {!hasChanges && <span>未做任何更改</span>}
            </div>
            {hiddenJoinedCount > 0 && (
                <span className="text-muted-foreground/70">{hiddenJoinedCount} 项隐藏</span>
            )}
        </div>
    )

    const ActionButtons = (
        <div className="flex gap-2 w-full">
            <Button
                variant="ghost"
                onClick={handleCancel}
                className="flex-1 h-11"
                disabled={saving}
            >
                取消
            </Button>
            <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="flex-[1.4] h-11 font-bold"
            >
                {saving ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        保存中
                    </>
                ) : hasChanges ? (
                    `保存更改 (${toAdd.length + toRemove.length})`
                ) : (
                    "完成"
                )}
            </Button>
        </div>
    )

    const headerTitle = "管理所在歌单"
    const headerDesc = track?.name
        ? `「${track.name}」将在保存后写入选择的歌单`
        : "勾选要加入的歌单，取消勾选已加入项即从该歌单移出"

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-[20px] px-5 pb-6 pt-2 max-h-[90vh] flex flex-col gap-3"
                    showCloseButton={false}
                >
                    <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted shrink-0" />
                    <SheetHeader className="text-left gap-1 p-0 shrink-0">
                        <SheetTitle className="flex items-center gap-2 text-lg">
                            <ListMusic className="w-5 h-5 text-primary" />
                            {headerTitle}
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            {headerDesc}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 min-h-0 overflow-hidden">{ListSection}</div>

                    <div className="shrink-0 flex flex-col gap-2 pt-1 border-t border-border/40">
                        {SummaryBar}
                        {ActionButtons}
                    </div>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListMusic className="w-5 h-5 text-primary" />
                        {headerTitle}
                    </DialogTitle>
                    <DialogDescription>{headerDesc}</DialogDescription>
                </DialogHeader>

                <div className="py-2">{ListSection}</div>

                <div className="px-1">{SummaryBar}</div>

                <DialogFooter className="flex-col sm:flex-row gap-3">
                    {ActionButtons}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}