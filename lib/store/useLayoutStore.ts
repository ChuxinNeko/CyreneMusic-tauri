import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
    isSidebarCollapsed: boolean
    devModeUnlocked: boolean
    isTaskbarPlayerEnabled: boolean
    taskbarPlayerPosition: 'left' | 'center' | 'right'
    isLiquidGlassVisible: boolean
    _settingsClickCount: number
    _lastSettingsClickTime: number
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    toggleTaskbarPlayer: () => void
    setTaskbarPlayerEnabled: (enabled: boolean) => void
    setTaskbarPlayerPosition: (position: 'left' | 'center' | 'right') => void
    handleSettingsClick: () => void
    showLiquidGlass: () => void
    hideLiquidGlass: () => void
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set, get) => ({
            isSidebarCollapsed: false,
            devModeUnlocked: false,
            isTaskbarPlayerEnabled: false,
            taskbarPlayerPosition: 'center',
            isLiquidGlassVisible: false,
            _settingsClickCount: 0,
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
        }),
        {
            name: 'cyrene-layout-store',
            partialize: (state) => ({
                isSidebarCollapsed: state.isSidebarCollapsed,
                devModeUnlocked: state.devModeUnlocked,
                isTaskbarPlayerEnabled: state.isTaskbarPlayerEnabled,
                taskbarPlayerPosition: state.taskbarPlayerPosition,
            }),
        }
    )
)
