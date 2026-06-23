"use client"

import * as React from "react"
import { Search, X, Clock, Trash2, Flame } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { urlService } from "@/lib/services/urlService"
import { useUIThemeStore } from "@/lib/store/useUIThemeStore"

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

const SEARCH_HISTORY_KEY = "cyrene_search_history"

interface HotSearchItem {
    first: string;
    second: number;
    third: number;
    iconType: number;
}

export function SearchBox() {
    const router = useRouter()
    const [keyword, setKeyword] = React.useState("")
    const [history, setHistory] = React.useState<string[]>([])
    const [suggestions, setSuggestions] = React.useState<{ keyword: string }[]>([])
    const [inlineSuggestion, setInlineSuggestion] = React.useState("")
    const [hotSearches, setHotSearches] = React.useState<HotSearchItem[]>([])
    const debouncedKeyword = useDebounce(keyword, 300)
    const [isFocused, setIsFocused] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const formRef = React.useRef<HTMLFormElement>(null)
    const popupRef = React.useRef<HTMLDivElement>(null)
    const [popupPos, setPopupPos] = React.useState({ top: 0, left: 0, width: 0 })
    const { currentTheme } = useUIThemeStore()

    // 加载搜索历史
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

    // 获取热搜数据
    React.useEffect(() => {
        if (!isFocused || keyword.trim()) return

        const fetchHotSearches = async () => {
            try {
                const resp = await fetch(`${urlService.baseUrl}/search/hot`)
                const data = await resp.json()
                if (data.status === 200 && data.result?.hots) {
                    setHotSearches(data.result.hots)
                }
            } catch (e) {
                console.error("Failed to fetch hot searches", e)
            }
        }
        fetchHotSearches()
    }, [isFocused, keyword])

    // 当弹出框可见时，监听滚动/resize 以更新位置
    const showPopup = isFocused && (keyword.trim() ? suggestions.length > 0 : (history.length > 0 || hotSearches.length > 0))
    React.useEffect(() => {
        if (!showPopup) return
        const updatePos = () => {
            const el = formRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            setPopupPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })
        }
        updatePos()
        window.addEventListener("scroll", updatePos, true)
        window.addEventListener("resize", updatePos)
        return () => {
            window.removeEventListener("scroll", updatePos, true)
            window.removeEventListener("resize", updatePos)
        }
    }, [showPopup])

    React.useEffect(() => {
        if (!debouncedKeyword.trim()) {
            setSuggestions([])
            setInlineSuggestion("")
            return
        }

        const fetchSuggestions = async () => {
            try {
                const resp = await fetch(`${urlService.baseUrl}/search/suggest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ keywords: debouncedKeyword, type: 'mobile' })
                })
                const data = await resp.json()
                if (data.status === 200 && data.result?.allMatch) {
                    const matches = data.result.allMatch
                    setSuggestions(matches)

                    // Find first suggestion that strictly starts with the current keyword (case-insensitive)
                    const lowerKeyword = debouncedKeyword.toLowerCase()
                    const inlineMatch = matches.find((m: any) => m.keyword.toLowerCase().startsWith(lowerKeyword))

                    if (inlineMatch && keyword === debouncedKeyword) {
                        // We need to preserve the user's exactly typed casing for the prefix part
                        // and append the remainder from the suggestion.
                        // Wait, a simpler way to simulate "inline suggestion" is just mapping the remaining text
                        const suggestionText = inlineMatch.keyword
                        const matchPrefixLength = keyword.length
                        // Only set if we actually matched the prefix 
                        if (suggestionText.toLowerCase().startsWith(keyword.toLowerCase())) {
                            setInlineSuggestion(keyword + suggestionText.slice(matchPrefixLength))
                        } else {
                            setInlineSuggestion("")
                        }
                    } else {
                        setInlineSuggestion("")
                    }
                } else {
                    setSuggestions([])
                    setInlineSuggestion("")
                }
            } catch (e) {
                console.error("Failed to fetch suggestions", e)
                setSuggestions([])
                setInlineSuggestion("")
            }
        }
        fetchSuggestions()
    }, [debouncedKeyword, keyword])

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
        setInlineSuggestion("")
        router.push(`/search?q=${encodeURIComponent(term.trim())}`)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' && inlineSuggestion && inlineSuggestion.toLowerCase().startsWith(keyword.toLowerCase())) {
            e.preventDefault()
            setKeyword(inlineSuggestion)
        } else if (e.key === 'ArrowRight' && inlineSuggestion && keyword.length === (e.target as HTMLInputElement).selectionEnd) {
            e.preventDefault()
            setKeyword(inlineSuggestion)
        }
    }

    return (
        <div ref={containerRef} className="relative w-full max-w-sm" data-tauri-drag-region>
            <form
                ref={formRef}
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSearch(keyword)
                }}
                className="relative z-20 flex items-center group"
            >
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground z-30" />

                <Input
                    type="search"
                    placeholder="搜索音乐、视频、歌词..."
                    className={currentTheme === 'fluent' 
                        ? "w-full pl-10 h-9 rounded-md border-none bg-muted/40 focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all z-20 relative text-sm shadow-inner"
                        : "w-full bg-muted/50 pl-10 h-9 rounded-full border-none focus-visible:ring-1 transition-all focus-visible:bg-muted z-20 relative text-sm"
                    }
                    value={keyword}
                    onChange={(e) => {
                        setKeyword(e.target.value)
                        if (inlineSuggestion && !inlineSuggestion.toLowerCase().startsWith(e.target.value.toLowerCase())) {
                            setInlineSuggestion("")
                        }
                    }}
                    onFocus={() => setIsFocused(true)}
                    onKeyDown={handleKeyDown}
                />

                {/* Visual inline suggestion layer - placed after Input to be on top */}
                <div className="absolute inset-0 pointer-events-none flex items-center z-30 text-sm">
                    <div className="w-full pl-10 pr-3 h-9 flex items-center">
                        {inlineSuggestion && inlineSuggestion.toLowerCase().startsWith(keyword.toLowerCase()) && keyword.length > 0 ? (
                            <span className="truncate">
                                <span className="opacity-0">{keyword}</span>
                                <span className="text-muted-foreground/50">{inlineSuggestion.slice(keyword.length)}</span>
                            </span>
                        ) : null}
                    </div>
                </div>
            </form>

            {typeof document !== "undefined" && showPopup && createPortal(
                <>
                    {/* 透明遮罩层，点击关闭弹出框 */}
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setIsFocused(false)}
                    />
                    <div
                        ref={popupRef}
                        className={`fixed overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 ${currentTheme === 'fluent' ? 'bg-background/70 dark:bg-[#1c1c1c]/70 backdrop-blur-xl rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-border/50' : 'bg-background rounded-xl shadow-xl border border-border/50'}`}
                        style={{ top: popupPos.top, left: popupPos.left, width: popupPos.width, minWidth: 300 }}
                >
                    <div className="p-3">
                        {!keyword.trim() ? (
                            <>
                                {/* 热搜区域 */}
                                {hotSearches.length > 0 && (
                                    <div className="mb-3">
                                        <div className="flex items-center gap-1 mb-2">
                                            <Flame className="h-3 w-3 text-orange-500" />
                                            <span className="text-xs font-semibold text-muted-foreground">热搜榜</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {hotSearches.slice(0, 10).map((item, index) => (
                                                <div
                                                    key={item.first}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted/50 hover:bg-muted/80 rounded-full cursor-pointer text-xs transition-colors"
                                                    onClick={() => handleSearch(item.first)}
                                                >
                                                    <span className={`font-medium ${index < 3 ? 'text-orange-500' : 'text-foreground/80'}`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-foreground/90">{item.first}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 搜索历史区域 */}
                                {history.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
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
                                        <div className="flex flex-wrap gap-1.5">
                                            {history.map((item) => (
                                                <div
                                                    key={item}
                                                    className="group inline-flex items-center gap-1 px-2.5 py-1 bg-muted/50 hover:bg-muted/80 rounded-full cursor-pointer text-xs transition-colors"
                                                    onClick={() => handleSearch(item)}
                                                >
                                                    <span className="text-foreground/90">{item}</span>
                                                    <button
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                                        onClick={(e) => removeHistoryItem(item, e)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-muted-foreground px-2 pb-2 mb-1 border-b border-border/50 flex items-center gap-1">
                                    <Search className="h-3 w-3" />
                                    搜索建议
                                </span>
                                {suggestions.map((item, index) => (
                                    <div
                                        key={`${item.keyword}-${index}`}
                                        className="flex items-center px-2 py-1.5 hover:bg-muted/50 rounded-md cursor-pointer text-sm transition-colors"
                                        onClick={() => {
                                            setKeyword(item.keyword)
                                            handleSearch(item.keyword)
                                        }}
                                    >
                                        <span className="truncate flex-1 text-foreground/90">{item.keyword}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    )
}
