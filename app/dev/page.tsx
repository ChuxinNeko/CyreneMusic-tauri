"use client"

import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useLogStore, LogEntry } from "@/stores/logStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Cpu, HardDrive, TerminalSquare, Trash2 } from "lucide-react"

interface SystemInfo {
    name: string
    os_version: string
    kernel_version: string
    total_memory: number
}

interface ProcessInfo {
    memory: number
    cpu_usage: number
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default function DevPage() {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
    const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)

    const logs = useLogStore((state) => state.logs)
    const clearLogs = useLogStore((state) => state.clearLogs)

    const logsEndRef = useRef<HTMLDivElement>(null)

    const fetchSystemInfo = async () => {
        try {
            const info = await invoke<SystemInfo>("get_system_info")
            setSystemInfo(info)
        } catch (e) {
            console.error("Failed to fetch system info", e)
        }
    }

    const fetchProcessInfo = async () => {
        try {
            const info = await invoke<ProcessInfo>("get_process_info")
            setProcessInfo(info)
        } catch (e) {
            console.error("Failed to fetch process info", e)
        }
    }

    useEffect(() => {
        fetchSystemInfo()
        fetchProcessInfo()
    }, [])

    useEffect(() => {
        if (!autoRefresh) return

        // 定时刷新进程和系统信息，系统信息不用刷那么勤，但方便起见一起
        const interval = setInterval(() => {
            fetchSystemInfo()
            fetchProcessInfo()
        }, 1000)

        return () => clearInterval(interval)
    }, [autoRefresh])

    useEffect(() => {
        // 日志更新时滚动到最下面
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs])

    const getLogColor = (level: string) => {
        switch (level) {
            case 'error': return 'text-red-500'
            case 'warn': return 'text-yellow-500'
            case 'info': return 'text-blue-500'
            default: return 'text-gray-500'
        }
    }

    return (
        <div className="flex flex-col h-full space-y-4 p-4">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <TerminalSquare className="w-6 h-6" />
                    开发者工具
                </h1>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">自动刷新 (1s)</span>
                    <Switch
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* 系统信息卡片 */}
                <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="py-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-primary" />
                            系统信息
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        {systemInfo ? (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">操作系统:</span>
                                    <span className="font-medium">{systemInfo.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">系统版本:</span>
                                    <span className="font-medium">{systemInfo.os_version}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">内核版本:</span>
                                    <span className="font-medium">{systemInfo.kernel_version}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">总内存:</span>
                                    <span className="font-medium">{formatBytes(systemInfo.total_memory)}</span>
                                </div>
                            </>
                        ) : (
                            <div className="h-[104px] flex items-center justify-center text-muted-foreground">
                                正在加载...
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 进程占用卡片 */}
                <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="py-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-primary" />
                            进程占用
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        {processInfo ? (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">CPU 使用率:</span>
                                    <span className="font-medium tabular-nums text-primary">{processInfo.cpu_usage.toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">内存占用:</span>
                                    <span className="font-medium tabular-nums">{formatBytes(processInfo.memory)}</span>
                                </div>
                                <div className="mt-4 pt-1 !text-xs text-muted-foreground flex justify-end">
                                    该数据反映 Tauri 核心进程的资源消耗
                                </div>
                            </>
                        ) : (
                            <div className="h-[104px] flex items-center justify-center text-muted-foreground">
                                正在加载...
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 运行日志卡片 */}
            <Card className="flex flex-col flex-1 bg-card/40 backdrop-blur border-border/50 shadow-sm overflow-hidden mt-4">
                <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <span>运行日志</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-normal">
                            {logs.length}
                        </span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={clearLogs} className="h-8">
                        <Trash2 className="w-4 h-4 mr-1" />
                        清空
                    </Button>
                </CardHeader>
                <CardContent className="flex-1 p-0 relative">
                    <div className="absolute inset-2 border rounded-md bg-black/5 dark:bg-black/20 font-mono text-xs overflow-hidden">
                        <ScrollArea className="h-full w-full p-4">
                            {logs.length === 0 ? (
                                <div className="text-muted-foreground/50 italic text-center mt-10">
                                    暂无日志记录
                                </div>
                            ) : (
                                logs.map((log: LogEntry) => (
                                    <div key={log.id} className="mb-2 hover:bg-black/5 dark:hover:bg-white/5 rounded px-1 -mx-1 transition-colors">
                                        <span className="text-muted-foreground/50 mr-2 min-w-[70px] inline-block">
                                            [{new Date(log.timestamp).toLocaleTimeString()}]
                                        </span>
                                        <span className={`uppercase font-bold mr-2 w-[40px] inline-block ${getLogColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                        <span className="text-foreground break-all">{log.message}</span>
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>

        </div>
    )
}
