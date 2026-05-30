"use client"

import React, { useEffect } from "react"
import { Pin } from "lucide-react"

export default function TaskbarDropZonePage() {
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }
        document.addEventListener("contextmenu", handleContextMenu)
        return () => {
            document.removeEventListener("contextmenu", handleContextMenu)
        }
    }, [])

    return (
        <div className="w-full h-full p-1 bg-transparent flex items-center justify-center select-none pointer-events-none">
            <style global jsx>{`
                html, body {
                    background: transparent !important;
                }
                nextjs-portal, #__next-build-watcher {
                    display: none !important;
                }
            `}</style>
            <div className="w-full h-full rounded-md border-2 border-dashed border-blue-400/80 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-white text-sm font-medium drop-shadow-lg">
                    <Pin size={16} className="animate-bounce" />
                    <span>拖动到此处固定</span>
                </div>
            </div>
        </div>
    )
}
