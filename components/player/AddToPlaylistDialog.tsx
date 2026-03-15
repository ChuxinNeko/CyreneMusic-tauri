"use client"

import React, { useState, useEffect } from "react"
import { Plus, Loader2, Music, Check, ListMusic } from "lucide-react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { playlistService } from "@/lib/services/playlistService"
import { Playlist } from "@/lib/models/playlist"
import { Track } from "@/lib/models/track"

interface AddToPlaylistDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    track: Track | null
    onStatusChange?: () => void
    mode?: 'add' | 'remove'
}

export function AddToPlaylistDialog({ open, onOpenChange, track, onStatusChange, mode = 'add' }: AddToPlaylistDialogProps) {
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(false)
    const [inPlaylistIds, setInPlaylistIds] = useState<number[]>([])
    const [selectedIds, setSelectedIds] = useState<number[]>([]) // 本地选择状态
    const [isCreating, setIsCreating] = useState(false)
    const [newPlaylistName, setNewPlaylistName] = useState("")
    const [processingId, setProcessingId] = useState<number | null>(null)
    const [isRemoving, setIsRemoving] = useState(false) // 批量移除加载状态

    // 当对话框打开且歌曲存在时刷新状态
    useEffect(() => {
        if (open && track) {
            fetchStatus()
        }
    }, [open, track])

    const fetchStatus = async () => {
        if (!track) return
        setLoading(true)
        try {
            const [playlistsData, status] = await Promise.all([
                playlistService.getPlaylists(),
                playlistService.checkTrackInPlaylists(track.id, track.source)
            ])
            setPlaylists(playlistsData)
            setInPlaylistIds(status.playlistIds)
            setSelectedIds(status.playlistIds) // 初始化本地选择
        } catch (error) {
            toast.error("获取歌单信息失败")
        } finally {
            setLoading(false)
        }
    }

    const handleTogglePlaylist = async (playlist: Playlist) => {
        if (!track || processingId !== null || isRemoving) return

        if (mode === 'remove') {
            // 移除模式下仅切换本地选择，不执行 api
            setSelectedIds(prev => 
                prev.includes(playlist.id) 
                    ? prev.filter(id => id !== playlist.id)
                    : [...prev, playlist.id]
            )
            return
        }

        // 添加模式保持原逻辑：即点即加
        const isIn = inPlaylistIds.includes(playlist.id)
        setProcessingId(playlist.id)

        try {
            if (isIn) {
                const success = await playlistService.removeTrackFromPlaylist(playlist.id, track.id, track.source)
                if (success) {
                    setInPlaylistIds(prev => prev.filter(id => id !== playlist.id))
                    setSelectedIds(prev => prev.filter(id => id !== playlist.id))
                    toast.success("已从歌单中移除")
                } else {
                    toast.error("移除失败")
                }
            } else {
                const success = await playlistService.addTrackToPlaylist(
                    playlist.id,
                    track.id,
                    track.name,
                    track.artists,
                    track.album || "",
                    track.picUrl || "",
                    track.source
                )
                if (success) {
                    setInPlaylistIds(prev => [...prev, playlist.id])
                    setSelectedIds(prev => [...prev, playlist.id])
                    toast.success("已添加到歌单")
                } else {
                    toast.error("添加失败")
                }
            }
            onStatusChange?.()
        } catch (error) {
            toast.error("操作失败")
        } finally {
            setProcessingId(null)
        }
    }

    const handleConfirmRemoval = async () => {
        if (!track) return
        
        // 找出需要被移除的 ID（在初始 inPlaylistIds 中但不在当前 selectedIds 中）
        const toRemove = inPlaylistIds.filter(id => !selectedIds.includes(id))
        
        if (toRemove.length === 0) {
            onOpenChange(false)
            return
        }

        setIsRemoving(true)
        try {
            let successCount = 0
            for (const playlistId of toRemove) {
                const success = await playlistService.removeTrackFromPlaylist(playlistId, track.id, track.source)
                if (success) successCount++
            }
            
            if (successCount > 0) {
                toast.success(`已从 ${successCount} 个歌单中移除`)
                onStatusChange?.()
                onOpenChange(false)
            } else {
                toast.error("移除失败")
            }
        } catch (error) {
            toast.error("移除操作失败")
        } finally {
            setIsRemoving(false)
        }
    }

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim() || !track) return
        setLoading(true)
        try {
            const newPlaylist = await playlistService.createPlaylist(newPlaylistName)
            if (newPlaylist) {
                // 创建后立即添加歌曲
                const success = await playlistService.addTrackToPlaylist(
                    newPlaylist.id,
                    track.id,
                    track.name,
                    track.artists,
                    track.album || "",
                    track.picUrl || "",
                    track.source
                )
                if (success) {
                    toast.success(`歌单「${newPlaylistName}」已创建并添加歌曲`)
                    setInPlaylistIds(prev => [...prev, newPlaylist.id])
                    setSelectedIds(prev => [...prev, newPlaylist.id])
                    setNewPlaylistName("")
                    setIsCreating(false)
                    fetchStatus() // 刷新列表
                    onStatusChange?.()
                } else {
                    toast.error("歌单已创建但添加歌曲失败")
                }
            } else {
                toast.error("创建歌单失败")
            }
        } catch (error) {
            toast.error("创建失败")
        } finally {
            setLoading(false)
        }
    }

    // 移除模式下只显示该歌曲最初所在的歌单
    const filteredPlaylists = mode === 'remove' 
        ? playlists.filter(p => inPlaylistIds.includes(p.id))
        : playlists;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListMusic className="w-5 h-5 text-primary" />
                        {mode === 'remove' ? '请选择要移除的歌单' : '添加到歌单'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'remove' ? '取消勾选即代表将歌曲从该歌单中移出' : `管理歌曲「${track?.name}」所在的歌单`}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {loading && playlists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">加载歌单中...</span>
                        </div>
                    ) : (
                        <ScrollArea className="h-[300px] pr-4">
                            <div className="space-y-2">
                                {filteredPlaylists.map(playlist => {
                                    const isSelected = selectedIds.includes(playlist.id)
                                    const isProcessing = processingId === playlist.id
                                    return (
                                        <div
                                            key={playlist.id}
                                            onClick={() => handleTogglePlaylist(playlist)}
                                            className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isSelected
                                                ? 'bg-primary/10 border-primary/20 hover:bg-primary/20'
                                                : mode === 'remove' 
                                                    ? 'bg-destructive/5 border-destructive/10 hover:bg-destructive/10'
                                                    : 'bg-secondary/40 border-transparent hover:bg-secondary/60 hover:border-border/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {playlist.coverUrl ? (
                                                        <img src={playlist.coverUrl} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <Music className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-[15px] font-bold truncate ${isSelected ? 'text-primary' : mode === 'remove' ? 'text-destructive/70' : ''}`}>
                                                        {playlist.name}
                                                    </span>
                                                    <span className="text-[12px] text-muted-foreground">
                                                        {playlist.trackCount} 首歌曲
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isProcessing ? (
                                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                                ) : isSelected ? (
                                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                                                    </div>
                                                ) : mode === 'remove' ? (
                                                    <div className="w-5 h-5 rounded-full border-2 border-destructive/30 flex items-center justify-center" />
                                                ) : (
                                                    <Plus className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {mode === 'remove' && filteredPlaylists.length === 0 && !loading && (
                                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm italic">
                                        该歌曲未在任何歌单中
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-3">
                    {mode === 'remove' ? (
                        <div className="flex gap-2 w-full">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="flex-1"
                                disabled={isRemoving}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleConfirmRemoval}
                                className="flex-1 font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                disabled={isRemoving}
                            >
                                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {inPlaylistIds.filter(id => !selectedIds.includes(id)).length > 0 
                                    ? `确认移除 (${inPlaylistIds.filter(id => !selectedIds.includes(id)).length})` 
                                    : "完成"}
                            </Button>
                        </div>
                    ) : (
                        isCreating ? (
                            <div className="flex flex-col w-full gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Input
                                    placeholder="输入新歌单名称"
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    className="h-11"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1"
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        onClick={handleCreatePlaylist}
                                        disabled={!newPlaylistName.trim() || loading}
                                        className="flex-1 font-bold"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "创建并添加"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                onClick={() => setIsCreating(true)}
                                variant="outline"
                                className="w-full h-11 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border rounded-xl"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                新建歌单
                            </Button>
                        )
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
