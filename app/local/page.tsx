"use client"

import { useState, useEffect, useCallback } from "react"
import { Play, Loader2, Music2, FolderOpen, FileAudio, Search, RefreshCw, Trash2, HardDrive } from "lucide-react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AsyncImage } from "@/components/common/AsyncImage"
import { localMusicService, LocalTrackEntry } from "@/lib/services/localMusicService"
import { playerService } from "@/lib/services/playerService"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core"

const isMobilePlatform = () => {
    if (typeof window === 'undefined') return false
    const ua = navigator.userAgent.toLowerCase()
    return /android|iphone|ipad|ipod/.test(ua)
}

export default function LocalPage() {
    const [tracks, setTracks] = useState<LocalTrackEntry[]>([])
    const [folders, setFolders] = useState<{ path: string; scannedAt: number }[]>([])
    const [loading, setLoading] = useState(true)
    const [scanning, setScanning] = useState(false)
    const [searchKeyword, setSearchKeyword] = useState("")
    const [showFolders, setShowFolders] = useState(false)
    const { currentTrack, isPlaying } = usePlayerStore()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [allTracks, allFolders] = await Promise.all([
                localMusicService.getAll(),
                localMusicService.getFolders()
            ])
            setTracks(allTracks)
            setFolders(allFolders)
        } catch (error) {
            console.error("Failed to fetch local music:", error)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleScanFolder = async () => {
        if (isMobilePlatform()) {
            toast.info("移动端系统暂不支持扫描任意文件夹，请使用“导入单曲”功能")
            return
        }
        try {
            const { open } = await import("@tauri-apps/plugin-dialog")
            const selected = await open({ directory: true, multiple: false })
            if (!selected) return

            setScanning(true)
            const count = await localMusicService.scanFolder(selected as string)
            toast.success(`扫描完成，发现 ${count} 首歌曲`)
            await fetchData()
        } catch (error) {
            toast.error("扫描文件夹失败")
            console.error(error)
        } finally {
            setScanning(false)
        }
    }

    const handleImportFiles = async () => {
        if (isMobilePlatform()) {
            document.getElementById("mobile-audio-import")?.click()
            return
        }
        try {
            const { open } = await import("@tauri-apps/plugin-dialog")
            const selected = await open({
                multiple: true,
                filters: [{ name: "音频文件", extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac", "wma", "opus"] }]
            })
            if (!selected || (Array.isArray(selected) && selected.length === 0)) return

            setScanning(true)
            const paths = Array.isArray(selected) ? selected : [selected]
            const count = await localMusicService.importFiles(paths as string[])
            toast.success(`成功导入 ${count} 首歌曲`)
            await fetchData()
        } catch (error) {
            console.warn("桌面端原生文件选择器打开失败，已切换至备用文件选择器：", error)
            document.getElementById("mobile-audio-import")?.click()
        } finally {
            setScanning(false)
        }
    }

    const handleMobileFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setScanning(true)
        let count = 0
        try {
            const filePaths: string[] = []
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                try {
                    const arrayBuffer = await file.arrayBuffer()
                    const dataArray = new Uint8Array(arrayBuffer)
                    const savedPath: string = await invoke("local_music::save_mobile_local_music", {
                        fileName: file.name,
                        data: dataArray
                    })
                    filePaths.push(savedPath)
                } catch (fileErr) {
                    console.error(`保存文件 ${file.name} 失败:`, fileErr)
                }
            }

            if (filePaths.length > 0) {
                count = await localMusicService.importFiles(filePaths)
                toast.success(`成功导入 ${count} 首歌曲`)
                await fetchData()
            } else {
                toast.error("没有成功导入的歌曲")
            }
        } catch (error) {
            toast.error("导入文件失败")
            console.error(error)
        } finally {
            setScanning(false)
            e.target.value = ""
        }
    }

    const handleRescanFolder = async (folderPath: string) => {
        setScanning(true)
        try {
            const count = await localMusicService.rescanFolder(folderPath)
            toast.success(`重新扫描完成，发现 ${count} 首歌曲`)
            await fetchData()
        } catch (error) {
            toast.error("重新扫描失败")
        } finally {
            setScanning(false)
        }
    }

    const handleRemoveFolder = async (folderPath: string) => {
        try {
            await localMusicService.removeByFolder(folderPath)
            toast.success("已移除文件夹及其歌曲")
            await fetchData()
        } catch (error) {
            toast.error("移除失败")
        }
    }

    const handlePlayTrack = (entry: LocalTrackEntry, index: number) => {
        const track = localMusicService.toTrack(entry)
        const queue = filteredTracks.map(t => localMusicService.toTrack(t))
        playerService.playWithQueue(track, queue)
    }

    const handleSearch = async () => {
        if (!searchKeyword.trim()) {
            const all = await localMusicService.getAll()
            setTracks(all)
            return
        }
        const results = await localMusicService.search(searchKeyword)
        setTracks(results)
    }

    useEffect(() => {
        const timer = setTimeout(handleSearch, 300)
        return () => clearTimeout(timer)
    }, [searchKeyword])

    const filteredTracks = tracks

    const formatDuration = (seconds: number) => {
        if (!seconds || seconds <= 0) return "--:--"
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <ScrollArea className="h-full">
            <input
                type="file"
                id="mobile-audio-import"
                multiple
                accept="audio/*"
                onChange={handleMobileFileChange}
                className="hidden"
            />
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto pb-32"
            >
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
                        本地音乐
                    </h1>
                    <p className="text-muted-foreground">
                        管理和播放本地音频文件
                    </p>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        onClick={handleScanFolder}
                        disabled={scanning}
                        className="gap-2"
                    >
                        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                        扫描文件夹
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleImportFiles}
                        disabled={scanning}
                        className="gap-2"
                    >
                        <FileAudio className="h-4 w-4" />
                        导入单曲
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFolders(!showFolders)}
                        className="gap-2"
                    >
                        <HardDrive className="h-4 w-4" />
                        管理文件夹 ({folders.length})
                    </Button>
                    <div className="flex-1" />
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索本地歌曲..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Folder Manager */}
                {showFolders && folders.length > 0 && (
                    <div className="space-y-2 p-4 rounded-xl bg-accent/10 border border-accent/20">
                        <h3 className="text-sm font-bold text-muted-foreground mb-3">已扫描的文件夹</h3>
                        {folders.map((folder) => (
                            <div key={folder.path} className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-accent/20">
                                <span className="text-sm truncate flex-1 font-mono">{folder.path}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRescanFolder(folder.path)}
                                        disabled={scanning}
                                        className="h-7 px-2"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveFolder(folder.path)}
                                        className="h-7 px-2 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Track List */}
                {filteredTracks.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-bold tracking-tight">全部歌曲</h2>
                            <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                                {filteredTracks.length} 首
                            </span>
                        </div>

                        <div className="grid gap-1">
                            {filteredTracks.map((entry, index) => {
                                const isCurrent = currentTrack?.id === entry.filePath && currentTrack?.source === 'local'
                                return (
                                    <div
                                        key={entry.filePath}
                                        onDoubleClick={() => handlePlayTrack(entry, index)}
                                        className={`group flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 cursor-pointer border ${isCurrent
                                            ? 'bg-primary/10 border-primary/20 shadow-xl shadow-primary/5'
                                            : 'bg-transparent border-transparent hover:bg-accent/50 hover:border-accent'
                                            }`}
                                    >
                                        {/* Index / Playing indicator */}
                                        <div className="w-10 flex items-center justify-center shrink-0">
                                            {isCurrent && isPlaying ? (
                                                <div className="flex items-end gap-[2px] h-4 mb-0.5">
                                                    <div className="w-[3px] bg-primary animate-[music-bar-1_0.8s_ease-in-out_infinite]" />
                                                    <div className="w-[3px] bg-primary animate-[music-bar-2_0.8s_ease-in-out_infinite]" />
                                                    <div className="w-[3px] bg-primary animate-[music-bar-3_0.8s_ease-in-out_infinite]" />
                                                </div>
                                            ) : (
                                                <span className="text-xs font-black text-muted-foreground/30 group-hover:hidden tracking-tighter">
                                                    {(index + 1).toString().padStart(2, '0')}
                                                </span>
                                            )}
                                            <Play className={`h-4 w-4 hidden group-hover:block ${isCurrent ? 'text-primary' : 'text-foreground/80'} fill-current`} />
                                        </div>

                                        {/* Cover */}
                                        <div className="h-12 w-12 rounded-lg overflow-hidden shadow-md ring-1 ring-border/50 shrink-0 bg-muted">
                                            {entry.coverDataUrl ? (
                                                <img src={entry.coverDataUrl} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Music2 className="h-5 w-5 text-muted-foreground/30" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h4 className={`text-sm font-bold truncate tracking-tight transition-colors ${isCurrent ? 'text-primary font-black' : 'text-foreground group-hover:text-primary'}`}>
                                                {entry.name}
                                            </h4>
                                            <p className="text-xs font-medium text-muted-foreground/60 truncate">
                                                {entry.artists}
                                            </p>
                                        </div>

                                        {/* Album */}
                                        <div className="hidden md:block w-40 shrink-0">
                                            <p className="text-xs text-muted-foreground/50 truncate">{entry.album}</p>
                                        </div>

                                        {/* Duration */}
                                        <div className="w-14 text-right shrink-0">
                                            <span className="text-xs font-medium tabular-nums text-muted-foreground/60">
                                                {formatDuration(entry.duration)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-60">
                        <Music2 className="h-16 w-16 text-muted-foreground/20" />
                        <p className="text-muted-foreground font-medium">暂无本地歌曲</p>
                        <p className="text-sm text-muted-foreground/60">点击上方按钮扫描文件夹或导入单曲</p>
                    </div>
                )}
            </motion.div>

            <style jsx global>{`
                @keyframes music-bar-1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
                @keyframes music-bar-2 { 0%, 100% { height: 14px; } 50% { height: 6px; } }
                @keyframes music-bar-3 { 0%, 100% { height: 8px; } 50% { height: 16px; } }
            `}</style>
        </ScrollArea>
    )
}