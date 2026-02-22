import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
    isSidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            isSidebarCollapsed: false,
            toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
            setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),
        }),
        {
            name: 'cyrene-layout-store',
        }
    )
)
