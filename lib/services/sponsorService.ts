"use client"

import { urlService } from "@/lib/services/urlService"

export interface Sponsor {
    id: number
    username: string
    avatarUrl: string | null
    sponsorSince: string | null
}

export interface SponsorListResponse {
    enabled: boolean
    sponsors: Sponsor[]
    total: number
}

export interface SponsorStatus {
    isSponsor: boolean
    sponsorSince: string | null
    totalAmount: number
    donationCount: number
    sponsorRank: number | null
    donations: {
        id: number
        amount: number
        paymentType: string
        status: number
        paidAt: string | null
        createdAt: string
    }[]
}

class SponsorService {
    private static instance: SponsorService

    private constructor() {}

    public static getInstance(): SponsorService {
        if (!SponsorService.instance) {
            SponsorService.instance = new SponsorService()
        }
        return SponsorService.instance
    }

    /** 获取赞助墙列表 */
    public async getSponsorList(): Promise<{ code: number; data?: SponsorListResponse; message?: string }> {
        try {
            const response = await fetch(`${urlService.baseUrl}/sponsors/list`)
            return await response.json()
        } catch (e: any) {
            console.error("[SponsorService] 获取赞助列表失败:", e)
            return { code: 500, message: e.message || "网络错误" }
        }
    }

    /** 查询用户赞助状态 */
    public async getSponsorStatus(userId: number): Promise<{ code: number; data?: SponsorStatus; message?: string }> {
        try {
            const response = await fetch(`${urlService.baseUrl}/sponsors/status/${userId}`)
            return await response.json()
        } catch (e: any) {
            console.error("[SponsorService] 查询赞助状态失败:", e)
            return { code: 500, message: e.message || "网络错误" }
        }
    }

    /** 创建赞助记录 */
    public async createDonationRecord(params: {
        userId?: number
        outTradeNo: string
        amount: number
        paymentType: string
    }): Promise<{ code: number; data?: any; message?: string }> {
        try {
            const response = await fetch(`${urlService.baseUrl}/sponsors/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            })
            return await response.json()
        } catch (e: any) {
            console.error("[SponsorService] 创建赞助记录失败:", e)
            return { code: 500, message: e.message || "网络错误" }
        }
    }

    /** 创建支付订单 */
    public async createPayOrder(params: {
        type: string
        name: string
        money: string
        clientip: string
        out_trade_no: string
        method?: string
        device?: string
    }): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/pay/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...params,
                    method: params.method || "web",
                    device: params.device || "pc",
                }),
            })
            return await response.json()
        } catch (e: any) {
            console.error("[SponsorService] 创建支付订单失败:", e)
            throw e
        }
    }

    /** 查询支付状态 */
    public async queryPayStatus(outTradeNo: string): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/pay/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ out_trade_no: outTradeNo }),
            })
            return await response.json()
        } catch (e: any) {
            console.error("[SponsorService] 查询支付状态失败:", e)
            throw e
        }
    }

    /** 获取客户端 IP（使用后端 /ip-location 接口） */
    public async getClientIp(): Promise<string | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/ip-location`)
            const data = await response.json()
            if (data.success && data.ip) {
                return data.ip
            }
            return null
        } catch (e: any) {
            console.error("[SponsorService] 获取客户端IP失败:", e)
            return null
        }
    }

    /** 生成订单号 */
    public generateOutTradeNo(): string {
        const ts = Date.now()
        const rand = Math.floor(Math.random() * 900000) + 100000
        return `${ts}${rand}`
    }
}

export const sponsorService = SponsorService.getInstance()
