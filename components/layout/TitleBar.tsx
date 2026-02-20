"use client"

import { useTheme } from "next-themes"
import * as React from "react"
import { ChevronLeft, ChevronRight, Minus, Square, X, Moon, Sun, User, LogOut, Settings } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { useRouter } from "next/navigation"
import { SearchBox } from "./SearchBox"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TitleBar() {
    const { setTheme, theme } = useTheme()
    const [isMaximized, setIsMaximized] = React.useState(false)
    const { user, isLoggedIn, logout } = useAuthStore()
    const router = useRouter()

    React.useEffect(() => {
        const updateMaximizedState = async () => {
            const appWindow = getCurrentWindow();
            setIsMaximized(await appWindow.isMaximized());
        };

        updateMaximizedState();
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
        <div data-tauri-drag-region className="h-14 flex items-center px-4 select-none bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b">
            {/* Left Section: Navigation */}
            <div className="flex items-center gap-1 z-10 mr-4" data-tauri-drag-region>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Center Section: Search (Flex-1 and center its content) */}
            <div className="flex-1 flex justify-center items-center z-10" data-tauri-drag-region>
                <SearchBox />
            </div>

            {/* Right Section: Controls */}
            <div className="flex items-center z-10 ml-4" data-tauri-drag-region>
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

                <div className="mr-4 flex items-center">
                    {isLoggedIn ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-primary/20 p-0 overflow-hidden">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user?.avatarUrl} alt={user?.username} className="object-cover" />
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                            {user?.username?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 mt-1 rounded-xl shadow-xl border-muted-foreground/10 p-1.5 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center gap-2 px-2 py-2 mb-1">
                                    <Avatar className="h-10 w-10 border border-muted">
                                        <AvatarImage src={user?.avatarUrl} />
                                        <AvatarFallback className="text-sm bg-muted text-muted-foreground">
                                            {user?.username?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-semibold truncate">{user?.username}</span>
                                        <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                                    </div>
                                </div>
                                <DropdownMenuSeparator className="bg-muted-foreground/10 mx-1" />
                                <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer rounded-lg py-2 focus:bg-primary/5 focus:text-primary transition-colors mt-1">
                                    <User className="mr-2 h-4 w-4" />
                                    <span>我的</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer rounded-lg py-2 focus:bg-primary/5 focus:text-primary transition-colors">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>设置</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-muted-foreground/10 mx-1" />
                                <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg py-2 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors mb-1">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>退出登录</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-primary/20 p-0 overflow-hidden bg-muted/20"
                            onClick={() => router.push("/settings")}
                        >
                            <Avatar className="h-8 w-8 grayscale opacity-70">
                                <AvatarFallback className="bg-transparent">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    )}
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
