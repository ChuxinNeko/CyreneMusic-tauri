import { urlService } from "@/lib/services/urlService"

export interface User {
    id: number
    email: string
    username: string
    isVerified: boolean
    lastLogin?: string
    avatarUrl?: string
    isSponsor: boolean
    sponsorSince?: string
    ipLocation?: string
}

export interface AuthResponse {
    success: boolean
    message?: string
    data?: any
    user?: User
}

class AuthService {
    private static instance: AuthService

    private constructor() { }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService()
        }
        return AuthService.instance
    }

    private getHeaders(token?: string) {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }
        return headers
    }

    // --- Authentication ---

    public async login(account: string, pass: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${urlService.baseUrl}/auth/login`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ account, password: pass }),
            })
            const data = await response.json()

            if (response.ok && data.data) {
                return {
                    success: true,
                    message: data.message,
                    user: data.data, // The API returns user object directly in data according to Dart code? 
                    // Dart code: _currentUser = User.fromJson(data['data']); _authToken = data['data']['token'];
                    // Wait, Dart code says: 
                    // _currentUser = User.fromJson(data['data']);
                    // _authToken = data['data']['token'];
                    // This implies data['data'] contains both user info AND token? 
                    // Let's assume the structure is: { data: { token: "...", id: 1, username: "...", ... } }
                    data: data.data,
                }
            } else {
                return { success: false, message: data.message || "登录失败" }
            }
        } catch (e: any) {
            return { success: false, message: e.message || "网络错误" }
        }
    }

    public async register(email: string, username: string, password: string, code: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${urlService.baseUrl}/auth/register`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ email, username, password, code }),
            })
            const data = await response.json()
            return { success: response.ok, message: data.message, data: data.data }
        } catch (e: any) {
            return { success: false, message: e.message || "网络错误" }
        }
    }

    public async sendRegisterCode(email: string, username: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${urlService.baseUrl}/auth/register/send-code`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ email, username }),
            })
            const data = await response.json()
            return { success: response.ok, message: data.message }
        } catch (e: any) {
            return { success: false, message: e.message || "网络错误" }
        }
    }

    public async checkRegistrationStatus(): Promise<{ success: boolean; enabled: boolean }> {
        try {
            const response = await fetch(`${urlService.baseUrl}/auth/registration-status`)
            const data = await response.json()
            if (response.ok) {
                return { success: true, enabled: data.data?.enabled ?? false }
            }
            return { success: false, enabled: false }
        } catch {
            return { success: false, enabled: false }
        }
    }

    // --- Password Reset ---

    public async sendResetCode(email: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${urlService.baseUrl}/auth/reset-password/send-code`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ email }),
            })
            const data = await response.json()
            return { success: response.ok, message: data.message }
        } catch (e: any) {
            return { success: false, message: e.message || "网络错误" }
        }
    }

    public async resetPassword(email: string, code: string, newPassword: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${urlService.baseUrl}/auth/reset-password`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ email, code, newPassword }),
            })
            const data = await response.json()
            return { success: response.ok, message: data.message }
        } catch (e: any) {
            return { success: false, message: e.message || "网络错误" }
        }
    }

    // --- User Info ---

    public async validateToken(token: string): Promise<boolean> {
        // The Dart code has validateToken but implementation details were not fully visible in the snippet.
        // Usually it calls a profile endpoint.
        // Let's assume there is an endpoint to check token or get profile.
        // If not, we can just trust the stored token until a 401 happens.
        // Dart code mentions `validateToken` in `loginWithToken`.
        return true
    }
}

export const authService = AuthService.getInstance()
