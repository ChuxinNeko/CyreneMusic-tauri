"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { invoke } from "@tauri-apps/api/core"
import { isAndroidTauriRuntime } from "@/lib/utils/platform"

function StatusBarThemer() {
    const { resolvedTheme } = useTheme()

    React.useEffect(() => {
        if (resolvedTheme && isAndroidTauriRuntime()) {
            // is_dark_text should be true when the theme is 'light'
            const isDarkText = resolvedTheme === "light"
            invoke("set_status_bar_style", { isDarkText })
                .catch(e => console.error("Failed to set status bar style:", e))
        }
    }, [resolvedTheme])

    return null
}

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            <StatusBarThemer />
            {children}
        </NextThemesProvider>
    )
}
