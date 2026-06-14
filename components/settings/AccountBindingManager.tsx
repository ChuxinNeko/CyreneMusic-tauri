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
    const [isUnbinding, setIsUnbinding] = useState<"netease" | "kugou" | "qq" | null>(null)
    const [qrDialog, setQrDialog] = useState<{ open: boolean; platform: "netease" | "kugou" | "qq" }>({
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

    const handleUnbind = async (platform: "netease" | "kugou" | "qq") => {
        if (!token) return

        setIsUnbinding(platform)
        try {
            const success = platform === "netease"
                ? await accountService.unbindNetease(token)
                : platform === "kugou"
                    ? await accountService.unbindKugou(token)
                    : await accountService.unbindQq(token)

            if (success) {
                toast.success(`${platform === "netease" ? "网易云" : platform === "kugou" ? "酷狗" : "QQ音乐"}解绑成功`)
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

    const openBindDialog = (platform: "netease" | "kugou" | "qq") => {
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-2">
                <p className="text-sm text-muted-foreground/80">
                    绑定后可以跨设备同步各个平台的歌单、收藏及推荐算法。
                </p>
            </div>

            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>温馨提示</AlertTitle>
                <AlertDescription className="text-muted-foreground mt-1">
                    绑定的账号信息仅存储加密后的授权令牌或 Cookie，由后端代为请求相关音乐平台 API。Cyrene 绝不会记录您的明文密码，请放心使用。
                </AlertDescription>
            </Alert>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">正在同步绑定状态...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    <div className="animate-in fade-in zoom-in-95 duration-500 fill-mode-both delay-100">
                        <BindingCard
                            platform="netease"
                            name="网易云音乐"
                            bound={bindings?.netease?.bound || false}
                            nickname={bindings?.netease?.nickname}
                            avatarUrl={bindings?.netease?.avatarUrl}
                            onBind={() => openBindDialog("netease")}
                            onUnbind={() => handleUnbind("netease")}
                            isUnbinding={isUnbinding === "netease"}
                        />
                    </div>

                    <div className="animate-in fade-in zoom-in-95 duration-500 fill-mode-both delay-200">
                        <BindingCard
                            platform="kugou"
                            name="酷狗音乐"
                            bound={bindings?.kugou?.bound || false}
                            nickname={bindings?.kugou?.username}
                            avatarUrl={bindings?.kugou?.avatar}
                            onBind={() => openBindDialog("kugou")}
                            onUnbind={() => handleUnbind("kugou")}
                            isUnbinding={isUnbinding === "kugou"}
                        />
                    </div>

                    <div className="animate-in fade-in zoom-in-95 duration-500 fill-mode-both delay-300">
                        <BindingCard
                            platform="qq"
                            name="QQ音乐"
                            bound={bindings?.qq?.bound || false}
                            nickname={bindings?.qq?.nickname}
                            avatarUrl={bindings?.qq?.avatarUrl}
                            onBind={() => openBindDialog("qq")}
                            onUnbind={() => handleUnbind("qq")}
                            isUnbinding={isUnbinding === "qq"}
                        />
                    </div>
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
