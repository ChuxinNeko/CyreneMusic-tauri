"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { invoke } from "@tauri-apps/api/core"

export type WindowMaterial = "opaque" | "mica" | "acrylic"

interface SystemMaterialSupport {
    isMicaSupported: boolean
    isAcrylicSupported: boolean
}

interface WindowMaterialState {
    material: WindowMaterial
    systemSupport: SystemMaterialSupport
    setMaterial: (material: WindowMaterial) => void
    setSystemSupport: (support: SystemMaterialSupport) => void
}

export const useWindowMaterialStore = create<WindowMaterialState>()(
    persist(
        (set) => ({
            material: "mica",
            systemSupport: {
                isMicaSupported: false,
                isAcrylicSupported: false,
            },
            setMaterial: (material) => set({ material }),
            setSystemSupport: (support) => set({ systemSupport: support }),
        }),
        {
            name: "window-material-storage",
            storage: createJSONStorage(() => localStorage),
            // 只持久化 material 偏好，不持久化系统支持状态
            partialize: (state) => ({ material: state.material }),
        }
    )
)

/**
 * 获取系统对窗口材质的支持情况
 */
export async function fetchSystemMaterialSupport(): Promise<SystemMaterialSupport> {
    try {
        const info: any = await invoke("get_system_info")
        return {
            isMicaSupported: info.is_mica_supported,
            isAcrylicSupported: info.is_acrylic_supported,
        }
    } catch (e) {
        console.error("Failed to fetch system material support:", e)
        return { isMicaSupported: false, isAcrylicSupported: false }
    }
}

/**
 * 应用窗口材质到原生窗口
 */
export async function applyWindowMaterial(material: WindowMaterial): Promise<void> {
    try {
        await invoke("set_window_material", { material })
    } catch (e) {
        console.error("Failed to apply window material:", e)
    }
}

/**
 * 根据当前主题更新窗口材质的深色/浅色效果
 */
export async function updateWindowMaterialTheme(material: WindowMaterial, isDark: boolean): Promise<void> {
    try {
        await invoke("update_window_material", { material, isDark })
    } catch (e) {
        console.error("Failed to update window material theme:", e)
    }
}
