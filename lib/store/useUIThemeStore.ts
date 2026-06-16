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
    setTheme: (theme: UIThemeId) => void
}

export const useUIThemeStore = create<UIThemeState>()(
    persist(
        (set) => ({
            currentTheme: "shadcn",
            setTheme: (theme) => {
                set({ currentTheme: theme })
                // Apply theme class to document
                document.documentElement.setAttribute("data-ui-theme", theme)
            },
        }),
        {
            name: "ui-theme-storage",
        }
    )
)