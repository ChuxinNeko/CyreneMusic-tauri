"use client"

import type { RefObject } from "react"
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
    is_mica_supported: boolean
    is_acrylic_supported: boolean
}

interface ProcessInfo {
    memory: number
    cpu_usage: number
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return "0 Bytes"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function useIsMobilePortrait() {
    const [isMobilePortrait, setIsMobilePortrait] = useState(false)

    useEffect(() => {
        const portraitQuery = window.matchMedia("(orientation: portrait)")

        const updateLayoutMode = () => {
            setIsMobilePortrait(window.innerWidth < 768 && portraitQuery.matches)
        }

        updateLayoutMode()
        portraitQuery.addEventListener("change", updateLayoutMode)
        window.addEventListener("resize", updateLayoutMode)

        return () => {
            portraitQuery.removeEventListener("change", updateLayoutMode)
            window.removeEventListener("resize", updateLayoutMode)
        }
    }, [])

    return isMobilePortrait
}

function InfoRow({ label, value, valueClassName }: { label: string, value: string, valueClassName?: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className={`text-right font-medium break-all ${valueClassName ?? ""}`}>{value}</span>
        </div>
    )
}

function RefreshControl({ autoRefresh, onChange, mobile = false }: { autoRefresh: boolean, onChange: (value: boolean) => void, mobile?: boolean }) {
    return (
        <div className={`flex items-center ${mobile ? "justify-between rounded-xl border border-border/60 bg-card/50 px-3 py-2.5" : "space-x-2"}`}>
            <span className="text-sm text-muted-foreground">自动刷新 (1s)</span>
            <Switch checked={autoRefresh} onCheckedChange={onChange} />
        </div>
    )
}

function SystemInfoCard({ systemInfo, mobile = false }: { systemInfo: SystemInfo | null, mobile?: boolean }) {
    return (
        <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className={mobile ? "pb-2" : "py-3"}>
                <CardTitle className="text-lg flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-primary" />
                    系统信息
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
                {systemInfo ? (
                    <>
                        <InfoRow label="操作系统:" value={systemInfo.name} />
                        <InfoRow label="系统版本:" value={systemInfo.os_version} />
                        <InfoRow label="内核版本:" value={systemInfo.kernel_version} />
                        <InfoRow label="总内存:" value={formatBytes(systemInfo.total_memory)} />
                        <InfoRow
                            label="云母材质 (Mica):"
                            value={systemInfo.is_mica_supported ? "支持" : "不支持"}
                            valueClassName={systemInfo.is_mica_supported ? "text-green-500" : "text-red-500"}
                        />
                        <InfoRow
                            label="亚克力材质 (Acrylic):"
                            value={systemInfo.is_acrylic_supported ? "支持" : "不支持"}
                            valueClassName={systemInfo.is_acrylic_supported ? "text-green-500" : "text-red-500"}
                        />
                    </>
                ) : (
                    <div className="flex h-[104px] items-center justify-center text-muted-foreground">
                        正在加载...
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function ProcessInfoCard({ processInfo, mobile = false }: { processInfo: ProcessInfo | null, mobile?: boolean }) {
    return (
        <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className={mobile ? "pb-2" : "py-3"}>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    进程占用
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
                {processInfo ? (
                    <>
                        <InfoRow label="CPU 使用率:" value={`${processInfo.cpu_usage.toFixed(2)}%`} valueClassName="tabular-nums text-primary" />
                        <InfoRow label="内存占用:" value={formatBytes(processInfo.memory)} valueClassName="tabular-nums" />
                        <div className="mt-4 flex justify-end pt-1 text-xs text-muted-foreground">
                            该数据反映 Tauri 核心进程的资源消耗
                        </div>
                    </>
                ) : (
                    <div className="flex h-[104px] items-center justify-center text-muted-foreground">
                        正在加载...
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function LogsCard({ logs, clearLogs, logsEndRef, mobile = false }: { logs: LogEntry[], clearLogs: () => void, logsEndRef: RefObject<HTMLDivElement | null>, mobile?: boolean }) {
    return (
        <Card className={`flex flex-col bg-card/40 backdrop-blur border-border/50 shadow-sm overflow-hidden ${mobile ? "min-h-[48vh]" : "flex-1 mt-4"}`}>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${mobile ? "px-4 py-3" : "py-3"}`}>
                <CardTitle className="text-lg flex items-center gap-2 min-w-0">
                    <span className="truncate">运行日志</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-normal shrink-0">
                        {logs.length}
                    </span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearLogs} className="h-8 shrink-0">
                    <Trash2 className="w-4 h-4 mr-1" />
                    清空
                </Button>
            </CardHeader>
            <CardContent className={`relative flex-1 ${mobile ? "px-3 pb-3 pt-0" : "p-0"}`}>
                <div className={`absolute border rounded-md bg-black/5 dark:bg-black/20 font-mono text-xs overflow-hidden ${mobile ? "inset-0" : "inset-2"}`}>
                    <ScrollArea className="h-full w-full p-4">
                        {logs.length === 0 ? (
                            <div className="text-muted-foreground/50 italic text-center mt-10">
                                暂无日志记录
                            </div>
                        ) : (
                            logs.map((log: LogEntry) => (
                                <div key={log.id} className="mb-2 rounded px-1 -mx-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                    <span className="text-muted-foreground/50 mr-2 inline-block min-w-[70px] align-top">
                                        [{new Date(log.timestamp).toLocaleTimeString()}]
                                    </span>
                                    <span className={`mr-2 inline-block w-[40px] font-bold uppercase align-top ${getLogColor(log.level)}`}>
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
    )
}

function DesktopDevLayout({
    autoRefresh,
    setAutoRefresh,
    systemInfo,
    processInfo,
    logs,
    clearLogs,
    logsEndRef,
}: {
    autoRefresh: boolean
    setAutoRefresh: (value: boolean) => void
    systemInfo: SystemInfo | null
    processInfo: ProcessInfo | null
    logs: LogEntry[]
    clearLogs: () => void
    logsEndRef: RefObject<HTMLDivElement | null>
}) {
    return (
        <div className="flex flex-col h-full space-y-4 p-4">
            <div className="flex justify-between items-center mb-2 gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2 min-w-0">
                    <TerminalSquare className="w-6 h-6 shrink-0" />
                    <span className="truncate">开发者工具</span>
                </h1>
                <RefreshControl autoRefresh={autoRefresh} onChange={setAutoRefresh} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <SystemInfoCard systemInfo={systemInfo} />
                <ProcessInfoCard processInfo={processInfo} />
            </div>

            <LogsCard logs={logs} clearLogs={clearLogs} logsEndRef={logsEndRef} />
        </div>
    )
}

function MobilePortraitDevLayout({
    autoRefresh,
    setAutoRefresh,
    systemInfo,
    processInfo,
    logs,
    clearLogs,
    logsEndRef,
}: {
    autoRefresh: boolean
    setAutoRefresh: (value: boolean) => void
    systemInfo: SystemInfo | null
    processInfo: ProcessInfo | null
    logs: LogEntry[]
    clearLogs: () => void
    logsEndRef: RefObject<HTMLDivElement | null>
}) {
    return (
        <div className="flex min-h-full flex-col gap-3 px-3 pt-3 pb-[calc(140px+env(safe-area-inset-bottom))]">
            <Card className="border-border/50 bg-card/50 shadow-sm backdrop-blur">
                <CardHeader className="space-y-3 px-4 py-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <TerminalSquare className="h-5 w-5 text-primary" />
                            开发者工具
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            竖屏下使用移动端专属布局，便于查看系统状态与运行日志。
                        </p>
                    </div>
                    <RefreshControl autoRefresh={autoRefresh} onChange={setAutoRefresh} mobile />
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-3">
                <SystemInfoCard systemInfo={systemInfo} mobile />
                <ProcessInfoCard processInfo={processInfo} mobile />
            </div>

            <LogsCard logs={logs} clearLogs={clearLogs} logsEndRef={logsEndRef} mobile />
        </div>
    )
}

function getLogColor(level: string) {
    switch (level) {
        case "error":
            return "text-red-500"
        case "warn":
            return "text-yellow-500"
        case "info":
            return "text-blue-500"
        default:
            return "text-gray-500"
    }
}

export default function DevPage() {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
    const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const isMobilePortrait = useIsMobilePortrait()

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

        const interval = setInterval(() => {
            fetchSystemInfo()
            fetchProcessInfo()
        }, 1000)

        return () => clearInterval(interval)
    }, [autoRefresh])

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs])

    if (isMobilePortrait) {
        return (
            <MobilePortraitDevLayout
                autoRefresh={autoRefresh}
                setAutoRefresh={setAutoRefresh}
                systemInfo={systemInfo}
                processInfo={processInfo}
                logs={logs}
                clearLogs={clearLogs}
                logsEndRef={logsEndRef}
            />
        )
    }

    return (
        <DesktopDevLayout
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            systemInfo={systemInfo}
            processInfo={processInfo}
            logs={logs}
            clearLogs={clearLogs}
            logsEndRef={logsEndRef}
        />
    )
}
