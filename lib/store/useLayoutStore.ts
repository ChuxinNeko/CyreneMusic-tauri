import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
    isSidebarCollapsed: boolean
    devModeUnlocked: boolean
    isLiquidGlassVisible: boolean
    _settingsClickCount: number
    _lastSettingsClickTime: number
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    handleSettingsClick: () => void
    showLiquidGlass: () => void
    hideLiquidGlass: () => void
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set, get) => ({
            isSidebarCollapsed: false,
            devModeUnlocked: false,
            isLiquidGlassVisible: false,
            _settingsClickCount: 0,
            _lastSettingsClickTime: 0,
            toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
            setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),
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
            }),
        }
    )
)
