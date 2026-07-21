/**
 * 统一后端请求入口：检测登录态失效并触发清态 / 提示 / 重新登录。
 * 各 service 带 Authorization 的请求应使用 apiFetch，而不是裸 fetch。
 */

import { toast } from "sonner"
import { useAuthStore } from "@/lib/store/useAuthStore"

const SESSION_EXPIRED_COOLDOWN_MS = 4000
let lastHandledAt = 0
let handling = false

function hasAuthorization(init?: RequestInit): boolean {
    if (!init?.headers) return false
    if (init.headers instanceof Headers) {
        return !!init.headers.get("Authorization")
    }
    if (Array.isArray(init.headers)) {
        return init.headers.some(([k]) => k.toLowerCase() === "authorization")
    }
    const headers = init.headers as Record<string, string>
    return !!(headers.Authorization || headers.authorization)
}

export function isAuthFailureStatus(status: number): boolean {
    return status === 401 || status === 403
}

/** 部分接口 HTTP 200，用 body.code / message 表达鉴权失败 */
export function isAuthFailurePayload(data: unknown): boolean {
    if (!data || typeof data !== "object") return false
    const body = data as Record<string, unknown>
    const code = body.code ?? body.status
    // 仅认明确的鉴权类业务码，避免把业务 403 误判成登录过期
    if (code === 401 || code === 40101) return true

    const msg = String(body.message ?? body.msg ?? body.error ?? "").toLowerCase()
    if (!msg) return false

    return (
        /(invalid|expired|失效|过期).{0,12}(token|jwt|凭证|登录)/.test(msg) ||
        /(token|jwt|凭证).{0,12}(invalid|expired|失效|过期)/.test(msg) ||
        /unauthorized|unauthorised|未登录|登录已失效|登录已过期|登录失效|登录过期|鉴权失败/.test(msg)
    )
}

/**
 * 登录态失效：清空本地登录态 → 提示用户 → 打开登录弹窗。
 * 带冷却，避免并发请求连弹。
 */
export function handleSessionExpired(reason?: string) {
    if (typeof window === "undefined") return
    if (handling) return

    const { isLoggedIn, token, logout, openAuthDialog } = useAuthStore.getState()
    if (!isLoggedIn && !token) return

    const now = Date.now()
    if (now - lastHandledAt < SESSION_EXPIRED_COOLDOWN_MS) return

    handling = true
    lastHandledAt = now

    try {
        logout()
        toast.warning("登录已失效，请重新登录", {
            id: "session-expired",
            description: reason || "你的登录凭证已过期，部分功能需要重新登录后使用",
            duration: 6000,
        })
        openAuthDialog()
    } finally {
        handling = false
    }
}

/**
 * 带鉴权感知的 fetch：请求带 Authorization 时，识别 401/403 或 body 鉴权失败并处理会话。
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init)
    const sentAuth = hasAuthorization(init)

    if (!sentAuth) return response

    if (isAuthFailureStatus(response.status)) {
        handleSessionExpired()
        return response
    }

    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
        try {
            const data = await response.clone().json()
            if (isAuthFailurePayload(data)) {
                handleSessionExpired()
            }
        } catch {
            // 非 JSON 或解析失败，忽略
        }
    }

    return response
}