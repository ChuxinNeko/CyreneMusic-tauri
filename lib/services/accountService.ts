import { urlService } from "@/lib/services/urlService"

export interface BindingInfo {
    bound: boolean
    nickname?: string
    avatarUrl?: string
    avatar?: string
    userId?: string | number
    username?: string
}

export interface AccountBindings {
    netease: BindingInfo
    kugou: BindingInfo
    qq: BindingInfo
}

class AccountService {
    private static instance: AccountService

    private constructor() { }

    public static getInstance(): AccountService {
        if (!AccountService.instance) {
            AccountService.instance = new AccountService()
        }
        return AccountService.instance
    }

    private getHeaders(token: string) {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    }

    public async getBindings(token: string): Promise<AccountBindings | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/accounts/bindings`, {
                headers: this.getHeaders(token)
            })
            const result = await response.json()
            if (result.code === 200) {
                return result.data
            }
            return null
        } catch (e) {
            console.error("[AccountService] getBindings failed:", e)
            return null
        }
    }

    public async unbindNetease(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/accounts/netease/unbind`, {
                method: "POST",
                headers: this.getHeaders(token),
                body: JSON.stringify({
                    timestamp: Math.floor(Date.now() / 1000)
                })
            })
            const result = await response.json()
            return result.code === 200
        } catch (e) {
            console.error("[AccountService] unbindNetease failed:", e)
            return false
        }
    }

    public async unbindKugou(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/accounts/kugou/unbind`, {
                method: "POST",
                headers: this.getHeaders(token),
                body: JSON.stringify({
                    timestamp: Math.floor(Date.now() / 1000)
                })
            })
            const result = await response.json()
            return result.code === 200
        } catch (e) {
            console.error("[AccountService] unbindKugou failed:", e)
            return false
        }
    }

    public async unbindQq(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/accounts/qq/unbind`, {
                method: "POST",
                headers: this.getHeaders(token),
                body: JSON.stringify({
                    timestamp: Math.floor(Date.now() / 1000)
                })
            })
            const result = await response.json()
            return result.code === 200
        } catch (e) {
            console.error("[AccountService] unbindQq failed:", e)
            return false
        }
    }

    public async getNeteaseQRKey(): Promise<string | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/login/qr/key`)
            const result = await response.json()
            return result.data?.unikey || null
        } catch (e) {
            console.error("[AccountService] getNeteaseQRKey failed:", e)
            return null
        }
    }

    public async getNeteaseQRData(key: string): Promise<{ qrimg?: string; qrUrl: string } | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/login/qr/create?key=${key}`)
            const result = await response.json()
            return result.data || null
        } catch (e) {
            console.error("[AccountService] getNeteaseQRData failed:", e)
            return null
        }
    }

    public async checkNeteaseQR(key: string, userId: number): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/login/qr/check?key=${key}&userId=${userId}`)
            return await response.json()
        } catch (e) {
            console.error("[AccountService] checkNeteaseQR failed:", e)
            return { code: 500, message: "检查失败" }
        }
    }

    public async getKugouQRData(): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/kugou/login/qr/create`)
            const result = await response.json()
            if (result.code === 200) {
                return result.data
            }
            return null
        } catch (e) {
            console.error("[AccountService] getKugouQRData failed:", e)
            return null
        }
    }

    public async checkKugouQR(qrcode: string, userId: number): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/kugou/login/qr/check?qrcode=${qrcode}&userId=${userId}`)
            return await response.json()
        } catch (e) {
            console.error("[AccountService] checkKugouQR failed:", e)
            return { code: 500, message: "检查失败" }
        }
    }

    public async getQqQRData(): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/qq/login/qr/create`)
            const result = await response.json()
            if (result.code === 200) {
                return result.data
            }
            return null
        } catch (e) {
            console.error("[AccountService] getQqQRData failed:", e)
            return null
        }
    }

    public async checkQqQR(ptqrtoken: string, qrsig: string, userId: number): Promise<any> {
        try {
            const response = await fetch(`${urlService.baseUrl}/qq/login/qr/check?ptqrtoken=${ptqrtoken}&qrsig=${qrsig}&userId=${userId}`)
            return await response.json()
        } catch (e) {
            console.error("[AccountService] checkQqQR failed:", e)
            return { code: 500, message: "检查失败" }
        }
    }

    public async isNeteaseBound(token: string): Promise<boolean> {
        try {
            const data = await this.getBindings(token)
            return !!data?.netease?.bound
        } catch {
            return false
        }
    }
}

export const accountService = AccountService.getInstance()
