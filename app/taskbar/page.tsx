"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause, SkipForward, Pin, PinOff, X, ChevronUp } from "lucide-react"
import { listen, emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { Track } from "@/lib/models/track"

type PlayerMode = "taskbar" | "floating"

interface TaskbarRect {
    left: number
    top: number
    right: number
    bottom: number
}

export default function TaskbarPlayerPage() {
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [mode, setMode] = useState<PlayerMode>("taskbar")
    const [overTaskbar, setOverTaskbar] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const modeRef = useRef<PlayerMode>("taskbar")
    const taskbarRectRef = useRef<TaskbarRect | null>(null)
    const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isDraggingRef = useRef(false)

    // 缓存任务栏信息
    const fetchTaskbarInfo = useCallback(async () => {
        try {
            const rect = await invoke<TaskbarRect>("get_taskbar_info")
            taskbarRectRef.current = rect
            return rect
        } catch (e) {
            console.error("Failed to get taskbar info:", e)
            return null
        }
    }, [])

    // 判断坐标是否在任务栏区域内（加入边距容差）
    const isOverTaskbarArea = useCallback(
        (x: number, y: number, windowWidth: number, windowHeight: number) => {
            const rect = taskbarRectRef.current
            if (!rect) return false

            // 使用窗口中心点判断
            const centerX = x + windowWidth / 2
            const centerY = y + windowHeight / 2

            // 容差范围：水平方向必须在任务栏宽度范围内，垂直方向在任务栏区域附近
            const horizontalMargin = 50
            const verticalMargin = 80

            return (
                centerX >= rect.left - horizontalMargin &&
                centerX <= rect.right + horizontalMargin &&
                centerY >= rect.top - verticalMargin &&
                centerY <= rect.bottom + verticalMargin
            )
        },
        []
    )

    // 从任务栏模式切换为悬浮模式
    const switchToFloating = useCallback(async () => {
        try {
            await invoke("unpin_taskbar_player")
            // 从前端再次确认窗口尺寸
            const win = getCurrentWindow()
            await win.setSize({ type: "Logical", width: 380, height: 50 })
            setMode("floating")
            modeRef.current = "floating"
        } catch (e) {
            console.error("Failed to unpin taskbar player:", e)
        }
    }, [])

    // 从悬浮模式切换回任务栏模式
    const switchToTaskbar = useCallback(async () => {
        try {
            // 立即修改状态，避免调用 pin 命令移动窗口时触发 onMoved 事件重新将其设为 true
            modeRef.current = "taskbar"
            setMode("taskbar")
            setOverTaskbar(false)

            await invoke("hide_taskbar_drop_zone")
            await invoke("pin_taskbar_player")
        } catch (e) {
            console.error("Failed to pin taskbar player:", e)
            // 失败时恢复状态
            modeRef.current = "floating"
            setMode("floating")
        }
    }, [])

    // 监听 overTaskbar 状态，显示或隐藏新窗口
    useEffect(() => {
        if (overTaskbar) {
            invoke("show_taskbar_drop_zone").catch(console.error)
        } else {
            invoke("hide_taskbar_drop_zone").catch(console.error)
        }
    }, [overTaskbar])

    useEffect(() => {
        let unlistenState: (() => void) | null = null
        let unlistenModeChange: (() => void) | null = null
        let unlistenMoved: (() => void) | null = null

        const setup = async () => {
            // 监听播放状态
            unlistenState = await listen("player:state-change", (event: any) => {
                const payload = event.payload
                setCurrentTrack(payload.currentTrack)
                setIsPlaying(payload.isPlaying)
            })

            // 监听模式切换事件（从 Rust 端发出）
            unlistenModeChange = await listen("taskbar-player:mode-change", (event: any) => {
                const newMode = event.payload as PlayerMode
                setMode(newMode)
                modeRef.current = newMode
                if (newMode === "taskbar") {
                    setOverTaskbar(false)
                }
            })

            // 获取任务栏信息
            await fetchTaskbarInfo()

            const win = getCurrentWindow()

            // 监听窗口移动事件（仅悬浮模式需要）
            unlistenMoved = await win.onMoved(async ({ payload }) => {
                const currentMode = modeRef.current
                if (currentMode !== "floating") return

                const windowX = payload.x
                const windowY = payload.y

                // 悬浮模式下：检测是否拖到了任务栏区域
                setIsDragging(true)
                isDraggingRef.current = true

                // 确保有任务栏信息
                if (!taskbarRectRef.current) {
                    await fetchTaskbarInfo()
                }

                try {
                    const size = await win.innerSize()
                    const over = isOverTaskbarArea(windowX, windowY, size.width, size.height)
                    setOverTaskbar(over)
                } catch {}

                // 防抖检测拖拽结束
                if (dragEndTimerRef.current) {
                    clearTimeout(dragEndTimerRef.current)
                }
                
                const checkDragEnd = async () => {
                    try {
                        const isMouseDown = await invoke<boolean>("is_left_mouse_button_pressed")
                        if (isMouseDown) {
                            // 鼠标仍被按下，说明拖拽并未结束，只是鼠标没动，继续检测
                            dragEndTimerRef.current = setTimeout(checkDragEnd, 300)
                            return
                        }
                    } catch (e) {
                        console.error("Failed to check mouse state:", e)
                    }

                    setIsDragging(false)
                    isDraggingRef.current = false

                    const currentOverTaskbar = taskbarRectRef.current
                    if (currentOverTaskbar) {
                        const pos = await win.outerPosition()
                        const sz = await win.innerSize()
                        if (isOverTaskbarArea(pos.x, pos.y, sz.width, sz.height)) {
                            await switchToTaskbar()
                        }
                    }
                    setOverTaskbar(false)
                }

                dragEndTimerRef.current = setTimeout(checkDragEnd, 300)
            })

            // 请求当前播放状态
            emit("player:command", "request-sync")
        }

        setup()

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener("contextmenu", handleContextMenu)

        return () => {
            if (unlistenState) unlistenState()
            if (unlistenModeChange) unlistenModeChange()
            if (unlistenMoved) unlistenMoved()
            if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current)
            document.removeEventListener("contextmenu", handleContextMenu)
        }
    }, [fetchTaskbarInfo, switchToFloating, switchToTaskbar, isOverTaskbarArea, overTaskbar])

    const sendCommand = (command: string) => {
        emit("player:command", command)
    }

    const showMainWindow = async () => {
        const { getAllWindows } = await import("@tauri-apps/api/window")
        const windows = await getAllWindows()
        const main = windows.find((w) => w.label === "main")
        if (main) {
            await main.unminimize()
            await main.show()
            await main.setFocus()
        }
    }

    const handleClose = async () => {
        try {
            await invoke("close_taskbar_player")
        } catch {}
    }

    // 任务栏模式下的拖拽检测
    const handleTaskbarMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (modeRef.current !== "taskbar") return

            const startX = e.clientX
            const startY = e.clientY
            let hasMoved = false

            const handleMouseMove = async (ev: MouseEvent) => {
                if (hasMoved) return
                const dx = Math.abs(ev.clientX - startX)
                const dy = Math.abs(ev.clientY - startY)
                if (dx > 8 || dy > 8) {
                    hasMoved = true
                    document.removeEventListener("mousemove", handleMouseMove)
                    document.removeEventListener("mouseup", handleMouseUp)
                    await switchToFloating()
                }
            }

            const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
            }

            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
        },
        [switchToFloating]
    )

    // 空状态
    if (!currentTrack) {
        return <div className="w-full h-full bg-transparent" />
    }

    // ===== 悬浮模式 UI =====
    if (mode === "floating") {
        return (
            <div className="w-full h-full flex items-center px-3 bg-white rounded-xl border border-gray-200 shadow-md select-none group">
                <style global jsx>{`
                    html, body {
                        background: transparent !important;
                    }
                    nextjs-portal, #__next-build-watcher {
                        display: none !important;
                    }
                `}</style>

                {/* 封面 */}
                <div
                    className="w-8 h-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-md shadow-md border border-black/5"
                    onClick={showMainWindow}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={currentTrack.picUrl || "/default-cover.png"}
                        alt="cover"
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                    />
                </div>

                {/* 信息 (拖拽区域) */}
                <div
                    className="flex flex-col flex-1 mx-3 min-w-0 justify-center h-full"
                    data-tauri-drag-region
                >
                    <span className="text-sm font-semibold truncate text-gray-900 drop-shadow-sm pointer-events-none">
                        {currentTrack.name}
                    </span>
                    <span className="text-xs text-gray-600 truncate pointer-events-none">
                        {currentTrack.artists}
                    </span>
                </div>

                {/* 控制按钮 */}
                <div className="flex items-center gap-3 flex-shrink-0 mr-2">
                    <button
                        className="text-gray-700 hover:text-gray-900 hover:scale-110 transition"
                        onClick={() => sendCommand("toggle-play")}
                    >
                        {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
                    </button>
                    <button
                        className="text-gray-700 hover:text-gray-900 hover:scale-110 transition"
                        onClick={() => sendCommand("next")}
                    >
                        <SkipForward size={18} />
                    </button>
                </div>

                {/* 窗口操作按钮 */}
                <div className="flex items-center gap-1.5 pl-3 border-l border-black/5 flex-shrink-0">
                    <button
                        className="text-gray-400 hover:text-gray-700 p-0.5 transition"
                        onClick={switchToTaskbar}
                        title="固定到任务栏"
                    >
                        <Pin size={14} />
                    </button>
                    <button
                        className="text-gray-400 hover:text-red-500 p-0.5 transition"
                        onClick={handleClose}
                        title="关闭"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        )
    }

    // ===== 任务栏模式 UI（原有样式）=====
    return (
        <div className="w-full h-full bg-transparent flex items-center px-3" onMouseDown={handleTaskbarMouseDown}>
            <style global jsx>{`
                html, body {
                    background: transparent !important;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>

            <div
                className="group relative w-8 h-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-md shadow-sm border border-white/10"
                onClick={showMainWindow}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={currentTrack.picUrl || "/default-cover.png"}
                    alt="cover"
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                />
            </div>

            <div
                className="flex flex-col flex-1 mx-3 min-w-0 justify-center cursor-pointer select-none"
                onClick={showMainWindow}
            >
                <span className="text-sm font-semibold truncate text-gray-500 drop-shadow-md">
                    {currentTrack.name}
                </span>
                <span className="text-xs text-gray-400 truncate drop-shadow-md">
                    {currentTrack.artists}
                </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:scale-110 transition drop-shadow-md"
                    onClick={() => sendCommand("toggle-play")}
                >
                    {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
                </button>
                <button
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:scale-110 transition drop-shadow-md"
                    onClick={() => sendCommand("next")}
                >
                    <SkipForward size={20} />
                </button>
            </div>
        </div>
    )
}