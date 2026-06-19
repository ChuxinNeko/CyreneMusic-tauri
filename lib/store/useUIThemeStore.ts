"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type UIThemeId = "shadcn" | "fluent"

export interface UIThemeConfig {
    id: UIThemeId
    name: string
    description: string
}

export const UI_THEMES: UIThemeConfig[] = [
    {
        id: "shadcn",
        name: "Shadcn UI",
        description: "现代简洁的组件风格，基于 Radix UI 和 Tailwind CSS",
    },
    {
        id: "fluent",
        name: "Fluent UI",
        description: "微软 Fluent Design 设计语言，圆润流畅的视觉体验",
    },
]

interface UIThemeState {
    currentTheme: UIThemeId
    userSelected: boolean
    setTheme: (theme: UIThemeId) => void
    enforceTheme: (theme: UIThemeId) => void
}

const getDefaultTheme = (): UIThemeId => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
        return "shadcn"
    }
    return "fluent"
}

export const useUIThemeStore = create<UIThemeState>()(
    persist(
        (set) => ({
            currentTheme: getDefaultTheme(),
            userSelected: false,
            setTheme: (theme) => {
                set({ currentTheme: theme, userSelected: true })
                document.documentElement.setAttribute("data-ui-theme", theme)
            },
            enforceTheme: (theme) => {
                set({ currentTheme: theme })
                document.documentElement.setAttribute("data-ui-theme", theme)
            },
        }),
        {
            name: "ui-theme-storage",
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<UIThemeState> | undefined
                if (!persisted) return currentState
                // 用户未手动选择过主题时，根据当前设备重新计算默认值
                if (!persisted.userSelected) {
                    return {
                        ...currentState,
                        ...persisted,
                        currentTheme: getDefaultTheme(),
                    }
                }
                return { ...currentState, ...persisted }
            },
            onRehydrateStorage: () => (state) => {
                if (state) {
                    document.documentElement.setAttribute("data-ui-theme", state.currentTheme)
                }
            },
        }
    )
)