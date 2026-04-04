"use client"

import { useState, Suspense } from "react"
import { CategorySelector } from "@/components/discovery/CategorySelector"
import { DiscoverGrid } from "@/components/discovery/DiscoverGrid"
import { PlaylistDetailView } from "@/components/discovery/PlaylistDetailView"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function DiscoverContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [selectedCategory, setSelectedCategory] = useState("全部歌单")
    const { token } = useAuthStore()

    const selectedPlaylistId = searchParams.get("playlist")

    const setSelectedPlaylistId = (id: string | number | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (id) {
            params.set("playlist", id.toString())
        } else {
            params.delete("playlist")
        }
        router.push(`/discover?${params.toString()}`)
    }

    if (selectedPlaylistId) {
        return (
            <div className="h-full">
                <PlaylistDetailView
                    id={selectedPlaylistId}
                    onBack={() => router.back()}
                    token={token || undefined}
                />
            </div>
        )
    }

    return (
        <div className="h-full overflow-x-hidden">
            <div className="px-3 sm:px-6 lg:px-10 pt-[max(12px,env(safe-area-inset-top))] pb-24 space-y-4 sm:space-y-8 max-w-7xl mx-auto">
                <header className="space-y-1 sm:space-y-3">
                    <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">发现</h1>
                    <p className="text-xs sm:text-base lg:text-lg text-muted-foreground">探索热门歌单，寻找属于你的旋律。</p>
                </header>

                <section className="space-y-3 sm:space-y-6">
                    <div className="sticky top-0 z-10 -mx-3 sm:-mx-6 lg:-mx-10 px-3 sm:px-6 lg:px-10 py-2 sm:py-4 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border-b border-border/40">
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
        </div>
    )
}

export default function DiscoverPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        }>
            <DiscoverContent />
        </Suspense>
    )
}
