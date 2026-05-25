import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CacheState {
    isCacheEnabled: boolean
    cacheDirectory: string | null
    setIsCacheEnabled: (enabled: boolean) => void
    setCacheDirectory: (dir: string) => void
}

export const useCacheStore = create<CacheState>()(
    persist(
        (set) => ({
            isCacheEnabled: true,
            cacheDirectory: null,
            setIsCacheEnabled: (enabled) => set({ isCacheEnabled: enabled }),
            setCacheDirectory: (dir) => set({ cacheDirectory: dir }),
        }),
        {
            name: 'cyrene-cache-storage',
        }
    )
)
