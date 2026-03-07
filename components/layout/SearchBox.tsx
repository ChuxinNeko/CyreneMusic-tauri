"use client"

import * as React from "react"
import { Search, X, Clock, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { urlService } from "@/lib/services/urlService"

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

export function SearchBox() {
    const router = useRouter()
    const [keyword, setKeyword] = React.useState("")
    const [history, setHistory] = React.useState<string[]>([])
    const [suggestions, setSuggestions] = React.useState<{ keyword: string }[]>([])
    const [inlineSuggestion, setInlineSuggestion] = React.useState("")
    const debouncedKeyword = useDebounce(keyword, 300)
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
                    className="w-full bg-muted/50 pl-10 h-9 rounded-full border-none focus-visible:ring-1 transition-all focus-visible:bg-muted z-20 relative text-sm"
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

            {isFocused && (keyword.trim() ? suggestions.length > 0 : history.length > 0) && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[300px] bg-background border border-border/50 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3">
                        {!keyword.trim() ? (
                            <>
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
            )}
        </div>
    )
}
