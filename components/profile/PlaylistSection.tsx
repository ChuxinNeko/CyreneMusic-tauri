"use client"

import { useState } from "react"
import { Library, Plus, Music2, ChevronRight, CloudDownload, MoreVertical, Trash2, Loader2, RefreshCw, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AsyncImage } from "@/components/common/AsyncImage"
import { Playlist } from "@/lib/models/playlist"
import { ImportPlaylistDialog } from "./ImportPlaylistDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { playlistService } from "@/lib/services/playlistService"
import { toast } from "sonner"

interface PlaylistSectionProps {
    playlists: Playlist[]
    onPlaylistClick: (id: string | number) => void
    onRefresh: () => void
    onRemoveLocally?: (id: string | number) => void
}

export function PlaylistSection({ playlists, onPlaylistClick, onRefresh, onRemoveLocally }: PlaylistSectionProps) {
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deletePlaylist, setDeletePlaylist] = useState<Playlist | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [syncingId, setSyncingId] = useState<string | number | null>(null)

    const handleSync = async (playlist: Playlist) => {
        if (!playlist.source || !playlist.sourcePlaylistId) return
        setSyncingId(playlist.id)
        try {
            const result = await playlistService.syncPlaylist(playlist.id)
            if (result) {
                if (result.insertedCount > 0) {
                    toast.success(`同步完成，新增 ${result.insertedCount} 首歌曲`)
                } else {
                    toast.success("歌单已是最新，无需更新")
                }
                onRefresh()
            } else {
                toast.error("同步歌单失败")
            }
        } catch (error) {
            toast.error("同步过程中发生错误")
        } finally {
            setSyncingId(null)
        }
    }

    const handleDelete = async () => {
        if (!deletePlaylist) return
        setDeleting(true)
        try {
            const success = await playlistService.deletePlaylist(deletePlaylist.id)
            if (success) {
                toast.success("歌单已成功删除")
                onRemoveLocally?.(deletePlaylist.id)
                onRefresh()
            } else {
                toast.error("删除歌单失败")
            }
        } catch (error) {
            toast.error("删除过程中发生错误")
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
            setDeletePlaylist(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <Library className="w-5 h-5 text-primary" />
                    <h2 className="text-2xl font-black tracking-tight">我的收藏</h2>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full flex items-center gap-1.5 h-8 px-3 hover:bg-primary/10 hover:text-primary transition-all"
                        onClick={() => setImportDialogOpen(true)}
                    >
                        <CloudDownload className="w-4 h-4" />
                        <span className="text-xs font-bold">导入</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0">
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {playlists.length > 0 ? (
                    playlists.map((playlist) => (
                        <div
                            key={playlist.id}
                            onClick={() => onPlaylistClick(playlist.id)}
                            className="group flex flex-col gap-3 rounded-2xl hover:bg-accent/10 p-3 transition-all cursor-pointer border border-transparent hover:border-border/50"
                        >
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-sm bg-muted ring-1 ring-border/50">
                                <AsyncImage src={playlist.coverUrl || ''} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                
                                {/* Overlay & Menu */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="absolute top-2 right-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full bg-background/50 hover:bg-background/80 text-foreground backdrop-blur-md border-0 shadow-sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {playlist.source && playlist.sourcePlaylistId && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer"
                                                        disabled={syncingId === playlist.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleSync(playlist)
                                                        }}
                                                    >
                                                        <RefreshCw className={`w-4 h-4 mr-2 ${syncingId === playlist.id ? 'animate-spin' : ''}`} />
                                                        同步歌单
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeletePlaylist(playlist)
                                                        setShowDeleteConfirm(true)
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    删除歌单
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                        <Button size="icon" className="rounded-full h-12 w-12 shadow-lg scale-90 group-hover:scale-100 transition-transform bg-primary text-primary-foreground hover:bg-primary/90 pointer-events-none">
                                            <Play className="h-6 w-6 fill-current" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col px-1">
                                <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                                    {playlist.name}
                                </h4>
                                <p className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate">
                                    {playlist.trackCount} 首歌曲
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-16 text-center bg-accent/5 rounded-[2rem] border-2 border-dashed border-accent/50 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Music2 className="w-8 h-8 text-primary/50" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">暂无收藏的歌单</h3>
                        <p className="text-sm text-muted-foreground">记录你的第一个歌单，开始音乐之旅</p>
                    </div>
                )}
            </div>

            <ImportPlaylistDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onImportSuccess={onRefresh}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>删除歌单</DialogTitle>
                        <DialogDescription>
                            确定要删除歌单「{deletePlaylist?.name}」吗？此操作无法撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                            取消
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            确认删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
