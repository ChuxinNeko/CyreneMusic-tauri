"use client"

import { useState } from "react"
import { CategorySelector } from "@/components/discovery/CategorySelector"
import { DiscoverGrid } from "@/components/discovery/DiscoverGrid"
import { PlaylistDetailView } from "@/components/discovery/PlaylistDetailView"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuthStore } from "@/lib/store/useAuthStore"

export default function DiscoverPage() {
    const [selectedCategory, setSelectedCategory] = useState("全部歌单")
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | number | null>(null)
    const { token } = useAuthStore()

    if (selectedPlaylistId) {
        return (
            <div className="h-full">
                <PlaylistDetailView
                    id={selectedPlaylistId}
                    onBack={() => setSelectedPlaylistId(null)}
                    token={token || undefined}
                />
            </div>
        )
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto pb-24">
                <header className="space-y-2">
                    <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">发现</h1>
                    <p className="text-muted-foreground lg:text-lg">探索热门歌单，寻找属于你的旋律。</p>
                </header>

                <section className="space-y-6">
                    <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 -mx-2 px-2 py-4">
                        <CategorySelector
                            selectedCategory={selectedCategory}
                            onCategoryChange={setSelectedCategory}
                        />
                    </div>

                    <DiscoverGrid
                        category={selectedCategory}
                        onPlaylistClick={(id) => setSelectedPlaylistId(id)}
                    />
                </section>
            </div>
        </ScrollArea>
    )
}
