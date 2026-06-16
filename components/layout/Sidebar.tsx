"use client"

import { useUIThemeStore } from "@/lib/store/useUIThemeStore"
import { ShadcnSidebar } from "./ShadcnSidebar"
import { FluentSidebar } from "./FluentSidebar"

export function Sidebar() {
    const { currentTheme } = useUIThemeStore()

    if (currentTheme === "fluent") {
        return <FluentSidebar />
    }

    return <ShadcnSidebar />
}