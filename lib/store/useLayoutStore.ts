import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 首页「全部榜单」的数据来源平台 */
export type ToplistSource = 'netease' | 'qq'

/** 首页「为你推荐」的数据来源平台 */
export type RecommendSource = 'netease' | 'qq'

interface LayoutState {
    isSidebarCollapsed: boolean
    devModeUnlocked: boolean
    isTaskbarPlayerEnabled: boolean
    taskbarPlayerPosition: 'left' | 'center' | 'right'
    isLiquidGlassVisible: boolean
    showDailyRecommendPopup: boolean
    toplistSource: ToplistSource
    recommendSource: RecommendSource
    _settingsClickCount: number
    _lastSettingsClickTime: number
    _recommendPopupTrigger: number
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    toggleTaskbarPlayer: () => void
    setTaskbarPlayerEnabled: (enabled: boolean) => void
    setTaskbarPlayerPosition: (position: 'left' | 'center' | 'right') => void
    handleSettingsClick: () => void
    showLiquidGlass: () => void
    hideLiquidGlass: () => void
    setShowDailyRecommendPopup: (show: boolean) => void
    setToplistSource: (source: ToplistSource) => void
    setRecommendSource: (source: RecommendSource) => void
    triggerRecommendPopup: () => void
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set, get) => ({
            isSidebarCollapsed: false,
            devModeUnlocked: false,
            isTaskbarPlayerEnabled: false,
            taskbarPlayerPosition: 'center',
            isLiquidGlassVisible: false,
            showDailyRecommendPopup: true,
            toplistSource: 'netease',
            recommendSource: 'netease',
            _settingsClickCount: 0,
            _recommendPopupTrigger: 0,
            _lastSettingsClickTime: 0,
            toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
            setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),
            toggleTaskbarPlayer: () => set((state) => ({ isTaskbarPlayerEnabled: !state.isTaskbarPlayerEnabled })),
            setTaskbarPlayerEnabled: (enabled: boolean) => set({ isTaskbarPlayerEnabled: enabled }),
            setTaskbarPlayerPosition: (position: 'left' | 'center' | 'right') => set({ taskbarPlayerPosition: position }),
            handleSettingsClick: () => {
                const now = Date.now()
                const { _settingsClickCount, _lastSettingsClickTime } = get()
                // Reset if more than 2s since last click
                if (now - _lastSettingsClickTime > 2000) {
                    set({ _settingsClickCount: 1, _lastSettingsClickTime: now })
                } else {
                    const newCount = _settingsClickCount + 1
                    if (newCount >= 5) {
                        set({ devModeUnlocked: true, _settingsClickCount: 0, _lastSettingsClickTime: now })
                    } else {
                        set({ _settingsClickCount: newCount, _lastSettingsClickTime: now })
                    }
                }
            },
            showLiquidGlass: () => set({ isLiquidGlassVisible: true }),
            hideLiquidGlass: () => set({ isLiquidGlassVisible: false }),
            setShowDailyRecommendPopup: (show: boolean) => set({ showDailyRecommendPopup: show }),
            setToplistSource: (toplistSource: ToplistSource) => set({ toplistSource }),
            setRecommendSource: (recommendSource: RecommendSource) => set({ recommendSource }),
            triggerRecommendPopup: () => set((state) => ({ _recommendPopupTrigger: state._recommendPopupTrigger + 1 })),
        }),
        {
            name: 'cyrene-layout-store',
            partialize: (state) => ({
                isSidebarCollapsed: state.isSidebarCollapsed,
                devModeUnlocked: state.devModeUnlocked,
                isTaskbarPlayerEnabled: state.isTaskbarPlayerEnabled,
                taskbarPlayerPosition: state.taskbarPlayerPosition,
                showDailyRecommendPopup: state.showDailyRecommendPopup,
                toplistSource: state.toplistSource,
                recommendSource: state.recommendSource,
            }),
        }
    )
)
