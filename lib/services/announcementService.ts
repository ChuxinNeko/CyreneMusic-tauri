"use client"

import { urlService } from "./urlService"

export interface Announcement {
    enabled: boolean
    id: string
    title: string
    content: string
}

class AnnouncementService {
    private static instance: AnnouncementService

    private constructor() {}

    public static getInstance(): AnnouncementService {
        if (!AnnouncementService.instance) {
            AnnouncementService.instance = new AnnouncementService()
        }
        return AnnouncementService.instance
    }

    /**
     * 从后端获取公告
     */
    async fetchAnnouncement(): Promise<Announcement | null> {
        try {
            const res = await fetch(`${urlService.baseUrl}/config/public`)
            if (!res.ok) return null
            const json = await res.json()
            const announcement = json?.data?.announcement as Announcement | undefined
            if (!announcement || !announcement.enabled) return null
            return announcement
        } catch (e) {
            console.error("[AnnouncementService] Failed to fetch announcement:", e)
            return null
        }
    }

    /**
     * 检查公告是否已被用户关闭（基于 id）
     */
    isDismissed(id: string): boolean {
        if (typeof window === "undefined") return true
        try {
            const dismissed = localStorage.getItem("dismissed_announcement_id")
            return dismissed === id
        } catch {
            return false
        }
    }

    /**
     * 标记公告为已关闭
     */
    dismiss(id: string): void {
        if (typeof window === "undefined") return
        try {
            localStorage.setItem("dismissed_announcement_id", id)
        } catch {}
    }
}

export const announcementService = AnnouncementService.getInstance()