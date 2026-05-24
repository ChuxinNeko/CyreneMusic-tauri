import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AudioSourceConfig, AudioSourceType } from '../models/audioSourceConfig'

interface AudioSourceState {
    sources: AudioSourceConfig[]
    quality: string
    isInitialized: boolean

    // Actions
    addSource: (source: AudioSourceConfig) => void
    updateSource: (source: AudioSourceConfig) => void
    removeSource: (id: string) => void
    setQuality: (quality: string) => void
    setInitialized: (initialized: boolean) => void
    setSources: (sources: AudioSourceConfig[]) => void
    reorderSources: (fromIndex: number, toIndex: number) => void
}

export const useAudioSourceStore = create<AudioSourceState>()(
    persist(
        (set, get) => ({
            sources: [],
            quality: 'exhigh',
            isInitialized: false,

            addSource: (source) => set((state) => ({
                sources: [...state.sources, source],
            })),

            updateSource: (source) => set((state) => ({
                sources: state.sources.map((s) => (s.id === source.id ? source : s)),
            })),

            removeSource: (id) => set((state) => ({
                sources: state.sources.filter((s) => s.id !== id),
            })),

            setQuality: (quality) => set({ quality }),

            setInitialized: (initialized) => set({ isInitialized: initialized }),

            setSources: (sources) => set({ sources }),

            reorderSources: (fromIndex, toIndex) => set((state) => {
                if (fromIndex === toIndex) return {}
                const newSources = [...state.sources]
                const [moved] = newSources.splice(fromIndex, 1)
                newSources.splice(toIndex, 0, moved)
                return { sources: newSources }
            }),
        }),
        {
            name: 'audio-source-storage',
            storage: createJSONStorage(() => localStorage),
            // 迁移：旧版本 store 中可能包含 activeSourceId，读取时自动忽略
            partialize: (state) => ({
                sources: state.sources,
                quality: state.quality,
                isInitialized: state.isInitialized,
            }),
        }
    )
)

/**
 * 获取最高优先级音源（即 sources[0]）
 */
export const usePrimarySource = () => {
    const { sources } = useAudioSourceStore();
    return sources.length > 0 ? sources[0] : null;
}

/**
 * 兼容别名：等价于 usePrimarySource
 */
export const useActiveSource = usePrimarySource;
