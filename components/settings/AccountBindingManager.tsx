"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldCheck, Info, Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { accountService, AccountBindings } from "@/lib/services/accountService"
import { BindingCard } from "./BindingCard"
import { QRCodeDialog } from "./QRCodeDialog"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function AccountBindingManager() {
    const { token, isLoggedIn } = useAuthStore()
    const [bindings, setBindings] = useState<AccountBindings | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isUnbinding, setIsUnbinding] = useState<"netease" | "kugou" | null>(null)
    const [qrDialog, setQrDialog] = useState<{ open: boolean; platform: "netease" | "kugou" }>({
        open: false,
        platform: "netease"
    })

    const fetchBindings = useCallback(async () => {
        if (!isLoggedIn || !token) return
        setIsLoading(true)
        const data = await accountService.getBindings(token)
        setBindings(data)
        setIsLoading(false)
    }, [isLoggedIn, token])

    useEffect(() => {
        fetchBindings()
    }, [fetchBindings])

    const handleUnbind = async (platform: "netease" | "kugou") => {
        if (!token) return

        setIsUnbinding(platform)
        try {
            const success = platform === "netease"
                ? await accountService.unbindNetease(token)
                : await accountService.unbindKugou(token)

            if (success) {
                toast.success(`${platform === "netease" ? "网易云" : "酷狗"}解绑成功`)
                fetchBindings()
            } else {
                toast.error("解绑失败，请稍后再试")
            }
        } catch (error) {
            toast.error("解绑过程中出现错误")
        } finally {
            setIsUnbinding(null)
        }
    }

    const openBindDialog = (platform: "netease" | "kugou") => {
        setQrDialog({ open: true, platform })
    }

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="p-4 bg-muted rounded-full">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-medium">请先登录</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        第三方账号绑定需要您先登录 Cyrene Music 账户，以便在不同设备间同步。
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">第三方账号绑定</h2>
                <p className="text-sm text-muted-foreground">
                    绑定后可以同步各个平台的歌单、收藏及推荐。
                </p>
            </div>

            <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-sm">温馨提示</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                    绑定的账号信息仅存储加密后的 Token 或 Cookie，用于后端代为请求相关 API。Cyrene 不会记录您的明文密码。
                </AlertDescription>
            </Alert>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">正在加载绑定状态...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    <BindingCard
                        platform="netease"
                        name="网易云音乐"
                        bound={bindings?.netease.bound || false}
                        nickname={bindings?.netease.nickname}
                        avatarUrl={bindings?.netease.avatarUrl}
                        onBind={() => openBindDialog("netease")}
                        onUnbind={() => handleUnbind("netease")}
                        isUnbinding={isUnbinding === "netease"}
                    />

                    <BindingCard
                        platform="kugou"
                        name="酷狗音乐"
                        bound={bindings?.kugou.bound || false}
                        nickname={bindings?.kugou.username}
                        avatarUrl={bindings?.kugou.avatar}
                        onBind={() => openBindDialog("kugou")}
                        onUnbind={() => handleUnbind("kugou")}
                        isUnbinding={isUnbinding === "kugou"}
                    />
                </div>
            )}

            <QRCodeDialog
                open={qrDialog.open}
                onOpenChange={(open) => setQrDialog({ ...qrDialog, open })}
                platform={qrDialog.platform}
                onSuccess={fetchBindings}
            />
        </div>
    )
}
