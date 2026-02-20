"use client"

import * as React from "react"
import { Search, X, Clock, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

const SEARCH_HISTORY_KEY = "cyrene_search_history"

export function SearchBox() {
    const router = useRouter()
    const [keyword, setKeyword] = React.useState("")
    const [history, setHistory] = React.useState<string[]>([])
    const [isFocused, setIsFocused] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
        if (stored) {
            try {
                setHistory(JSON.parse(stored))
            } catch (e) {
                console.error("Failed to parse search history", e)
            }
        }
    }, [])

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const saveHistory = (term: string) => {
        if (!term.trim()) return
        const newHistory = [term, ...history.filter(h => h !== term)].slice(0, 10) // Keep top 10
        setHistory(newHistory)
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
    }

    const removeHistoryItem = (term: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const newHistory = history.filter(h => h !== term)
        setHistory(newHistory)
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
    }

    const clearHistory = (e: React.MouseEvent) => {
        e.stopPropagation()
        setHistory([])
        localStorage.removeItem(SEARCH_HISTORY_KEY)
    }

    const handleSearch = (term: string) => {
        if (!term.trim()) return
        saveHistory(term.trim())
        setIsFocused(false)
        router.push(`/search?q=${encodeURIComponent(term.trim())}`)
    }

    return (
        <div ref={containerRef} className="relative w-full max-w-sm" data-tauri-drag-region>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSearch(keyword)
                }}
                className="relative z-20"
            >
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="搜索音乐、视频、歌词..."
                    className="w-full bg-muted/50 pl-10 h-9 rounded-full border-none focus-visible:ring-1 transition-all focus-visible:bg-muted"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                />
            </form>

            {isFocused && history.length > 0 && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[300px] bg-background border border-border/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3">
                        <div className="flex items-center justify-between mb-2 flex-row pb-1 border-b border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                搜索历史
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={clearHistory}
                                title="清空历史"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="flex flex-col gap-0.5 pt-1">
                            {history.map((item) => (
                                <div
                                    key={item}
                                    className="group flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors"
                                    onClick={() => {
                                        setKeyword(item)
                                        handleSearch(item)
                                    }}
                                >
                                    <span className="truncate flex-1">{item}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                        onClick={(e) => removeHistoryItem(item, e)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
