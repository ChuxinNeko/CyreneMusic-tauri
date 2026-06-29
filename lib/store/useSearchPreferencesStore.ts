import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * 搜索平台显示名称映射
 */
export const PLATFORM_LABELS: Record<string, string> = {
    netease: '网易云',
    qq: 'QQ 音乐',
    kugou: '酷狗',
    kuwo: '酷我',
    apple: 'Apple Music',
    spotify: 'Spotify',
    qishui: '汽水音乐',
}

interface SearchPreferencesState {
    /**
     * 用户启用的搜索平台列表。
     * 空数组表示使用当前音源支持的全部平台（向后兼容默认行为）。
     * 非空时仅向列表中且当前音源支持的平台发起搜索请求。
     */
    enabledPlatforms: string[]
    setEnabledPlatforms: (platforms: string[]) => void
    togglePlatform: (platform: string) => void
    reset: () => void
}

export const useSearchPreferencesStore = create<SearchPreferencesState>()(
    persist(
        (set) => ({
            enabledPlatforms: [],
            setEnabledPlatforms: (platforms) => set({ enabledPlatforms: platforms }),
            togglePlatform: (platform) => set((state) => {
                const isSelected = state.enabledPlatforms.includes(platform)
                if (isSelected) {
                    return { enabledPlatforms: state.enabledPlatforms.filter(p => p !== platform) }
                }
                return { enabledPlatforms: [...state.enabledPlatforms, platform] }
            }),
            reset: () => set({ enabledPlatforms: [] }),
        }),
        {
            name: 'search-preferences-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ enabledPlatforms: state.enabledPlatforms }),
        }
    )
)
