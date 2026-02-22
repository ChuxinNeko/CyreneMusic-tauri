"use client"

import { useState, useEffect } from "react"
import { discoveryService, DiscoveryTag } from "@/lib/services/discoveryService"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface CategorySelectorProps {
    selectedCategory: string
    onCategoryChange: (category: string) => void
}

export function CategorySelector({ selectedCategory, onCategoryChange }: CategorySelectorProps) {
    const [tags, setTags] = useState<DiscoveryTag[]>([])
    const [loading, setLoading] = useState(true)
    const [isExpanded, setIsExpanded] = useState(false)

    useEffect(() => {
        const fetchTags = async () => {
            setLoading(true)
            const result = await discoveryService.getDiscoverTags()
            setTags(result)
            setLoading(false)
        }
        fetchTags()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">加载分类中...</span>
            </div>
        )
    }

    // Default visible count
    const visibleCount = 10
    const visibleTags = tags.slice(0, visibleCount)
    const hiddenTags = tags.slice(visibleCount)

    return (
        <div className="w-full space-y-2">
            <div className="flex flex-wrap gap-2 py-2 transition-all duration-300">
                <Button
                    variant={selectedCategory === "全部歌单" ? "default" : "secondary"}
                    size="sm"
                    className="rounded-full px-4 h-8"
                    onClick={() => onCategoryChange("全部歌单")}
                >
                    全部
                </Button>

                {visibleTags.map((tag) => (
                    <Button
                        key={tag.id}
                        variant={selectedCategory === tag.name ? "default" : "secondary"}
                        size="sm"
                        className="rounded-full px-4 h-8"
                        onClick={() => onCategoryChange(tag.name)}
                    >
                        {tag.name}
                    </Button>
                ))}

                {!isExpanded && hiddenTags.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full px-4 h-8 text-muted-foreground hover:text-foreground group"
                        onClick={() => setIsExpanded(true)}
                    >
                        更多
                        <ChevronDown className="ml-1 h-3 w-3 transition-transform group-hover:translate-y-0.5" />
                    </Button>
                )}
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap gap-2 pb-4 pt-1 border-t mt-2">
                            {hiddenTags.map((tag) => (
                                <Button
                                    key={tag.id}
                                    variant={selectedCategory === tag.name ? "default" : "secondary"}
                                    size="sm"
                                    className="rounded-full px-4 h-8"
                                    onClick={() => onCategoryChange(tag.name)}
                                >
                                    {tag.name}
                                </Button>
                            ))}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full px-4 h-8 text-muted-foreground hover:text-foreground group"
                                onClick={() => setIsExpanded(false)}
                            >
                                收起
                                <ChevronUp className="ml-1 h-3 w-3 transition-transform group-hover:-translate-y-0.5" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
