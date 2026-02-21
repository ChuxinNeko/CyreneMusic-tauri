"use client"

import { useState, useEffect } from "react"
import { discoveryService, DiscoveryTag } from "@/lib/services/discoveryService"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface CategorySelectorProps {
    selectedCategory: string
    onCategoryChange: (category: string) => void
}

export function CategorySelector({ selectedCategory, onCategoryChange }: CategorySelectorProps) {
    const [tags, setTags] = useState<DiscoveryTag[]>([])
    const [loading, setLoading] = useState(true)

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

    return (
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-2 py-2">
                <Button
                    variant={selectedCategory === "全部歌单" ? "default" : "secondary"}
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => onCategoryChange("全部歌单")}
                >
                    全部
                </Button>
                {tags.map((tag) => (
                    <Button
                        key={tag.id}
                        variant={selectedCategory === tag.name ? "default" : "secondary"}
                        size="sm"
                        className="rounded-full px-4"
                        onClick={() => onCategoryChange(tag.name)}
                    >
                        {tag.name}
                    </Button>
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    )
}
