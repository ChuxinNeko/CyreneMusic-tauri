
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AudioSourceConfig, AudioSourceType } from '../models/audioSourceConfig'

interface AudioSourceState {
    sources: AudioSourceConfig[]
    activeSourceId: string
    isInitialized: boolean

    // Actions
    addSource: (source: AudioSourceConfig) => void
    updateSource: (source: AudioSourceConfig) => void
    removeSource: (id: string) => void
    setActiveSource: (id: string) => void
    setInitialized: (initialized: boolean) => void
}

export const useAudioSourceStore = create<AudioSourceState>()(
    persist(
        (set, get) => ({
            sources: [],
            activeSourceId: '',
            isInitialized: false,

            addSource: (source) => set((state) => {
                const newSources = [...state.sources, source];
                // If it's the first source, set it as active
                const activeId = state.sources.length === 0 ? source.id : state.activeSourceId;
                return { sources: newSources, activeSourceId: activeId };
            }),

            updateSource: (source) => set((state) => ({
                sources: state.sources.map((s) => (s.id === source.id ? source : s)),
            })),

            removeSource: (id) => set((state) => {
                const newSources = state.sources.filter((s) => s.id !== id);
                let newActiveId = state.activeSourceId;
                if (state.activeSourceId === id) {
                    newActiveId = newSources.length > 0 ? newSources[0].id : '';
                }
                return { sources: newSources, activeSourceId: newActiveId };
            }),

            setActiveSource: (id) => set({ activeSourceId: id }),

            setInitialized: (initialized) => set({ isInitialized: initialized }),
        }),
        {
            name: 'audio-source-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)

export const useActiveSource = () => {
    const { sources, activeSourceId } = useAudioSourceStore();
    return sources.find((s) => s.id === activeSourceId) || null;
}
