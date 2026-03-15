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
            <div className="px-4 sm:px-6 lg:px-10 pt-[max(16px,env(safe-area-inset-top))] pb-24 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
                <header className="space-y-2 sm:space-y-3">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">发现</h1>
                    <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">探索热门歌单，寻找属于你的旋律。</p>
                </header>

                <section className="space-y-5 sm:space-y-6">
                    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border-b border-border/40">
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
