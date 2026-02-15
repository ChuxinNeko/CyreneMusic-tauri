"use client"

import { useTheme } from "next-themes"
import * as React from "react"
import { ChevronLeft, ChevronRight, Search, Minus, Square, X, Moon, Sun } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function TitleBar() {
    const { setTheme, theme } = useTheme()
    const [isMaximized, setIsMaximized] = React.useState(false)

    React.useEffect(() => {
        const updateMaximizedState = async () => {
            const appWindow = getCurrentWindow();
            setIsMaximized(await appWindow.isMaximized());
        };

        updateMaximizedState();

        // Listen for resize events to update state if needed, though Tauri doesn't easily expose this event directly on window object for resize
        // For now we just check on mount. A robust implementation might check on resize or use an interval/event listener if available.
        // In Tauri v2, we might need plugins for deeper integration.

    }, [])

    const minimize = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
    }

    const toggleMaximize = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.toggleMaximize();
        setIsMaximized(!isMaximized);
    }

    const close = async () => {
        const appWindow = getCurrentWindow();
        await appWindow.close();
    }

    return (
        <div data-tauri-drag-region className="h-14 flex items-center justify-between pl-4 pr-0 select-none bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b">
            {/* Navigation & Search */}
            <div className="flex items-center gap-4 flex-1" data-tauri-drag-region>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="relative max-w-md w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="搜索音乐、视频、歌词、电台"
                        className="w-full bg-muted/50 pl-9 h-9 rounded-full border-none focus-visible:ring-1"
                    />
                </div>
            </div>

            {/* Window Controls & Theme Toggle */}
            <div className="flex items-center" data-tauri-drag-region>
                <div className="mr-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    >
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                </div>

                <div className="flex items-center h-14">
                    <Button variant="ghost" size="icon" className="h-14 w-12 rounded-none hover:bg-accent" onClick={minimize}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-14 w-12 rounded-none hover:bg-accent" onClick={toggleMaximize}>
                        <Square className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-14 w-12 rounded-none hover:bg-destructive hover:text-destructive-foreground" onClick={close}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
