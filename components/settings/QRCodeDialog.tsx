"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { accountService } from "@/lib/services/accountService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { toast } from "sonner"
import QRCode from "qrcode"

interface QRCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    platform: "netease" | "kugou"
    onSuccess: () => void
}

export function QRCodeDialog({ open, onOpenChange, platform, onSuccess }: QRCodeDialogProps) {
    const [qrData, setQrData] = useState<string | null>(null)
    const [qrKey, setQrKey] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "waiting" | "scanning" | "success" | "expired" | "error">("loading")
    const [message, setMessage] = useState("")
    const { user } = useAuthStore()

    const fetchQR = useCallback(async () => {
        if (!open) return
        setStatus("loading")
        setQrData(null)
        setQrKey(null)

        try {
            if (platform === "netease") {
                const key = await accountService.getNeteaseQRKey()
                if (key) {
                    setQrKey(key)
                    const data = await accountService.getNeteaseQRData(key)
                    if (data?.qrimg) {
                        setQrData(data.qrimg)
                        setStatus("waiting")
                    } else if (data?.qrUrl) {
                        try {
                            const localQr = await QRCode.toDataURL(data.qrUrl, {
                                margin: 2,
                                width: 200,
                                color: {
                                    dark: "#000000",
                                    light: "#ffffff"
                                }
                            })
                            setQrData(localQr)
                            setStatus("waiting")
                        } catch (qrErr) {
                            console.error("Local QR generation failed:", qrErr)
                            setStatus("error")
                            setMessage("本地生成二维码失败")
                        }
                    } else {
                        setStatus("error")
                        setMessage("生成二维码图片失败")
                    }
                } else {
                    setStatus("error")
                    setMessage("获取二维码 Key 失败")
                }
            } else {
                const data = await accountService.getKugouQRData()
                if (data && data.qrcode) {
                    setQrKey(data.qrcode)
                    try {
                        const localQr = await QRCode.toDataURL(data.qrUrl, {
                            margin: 2,
                            width: 200,
                            color: {
                                dark: "#000000",
                                light: "#ffffff"
                            }
                        })
                        setQrData(localQr)
                        setStatus("waiting")
                    } catch (qrErr) {
                        console.error("Local QR generation failed:", qrErr)
                        setStatus("error")
                        setMessage("本地生成二维码失败")
                    }
                } else {
                    setStatus("error")
                    setMessage("获取酷狗扫码数据失败")
                }
            }
        } catch (error) {
            console.error("Fetch QR failed:", error)
            setStatus("error")
            setMessage("网络错误，请稍后再试")
        }
    }, [open, platform])

    useEffect(() => {
        if (open) {
            fetchQR()
        }
    }, [open, fetchQR])

    useEffect(() => {
        let timer: NodeJS.Timeout
        if (open && status !== "success" && status !== "expired" && status !== "error" && qrKey && user) {
            timer = setInterval(async () => {
                try {
                    let res
                    if (platform === "netease") {
                        res = await accountService.checkNeteaseQR(qrKey, user.id)
                        // Netease codes: 800: expired, 801: waiting, 802: scanning, 803: success
                        if (res.code === 803) {
                            setStatus("success")
                            toast.success("网易云绑定成功")
                            setTimeout(() => {
                                onSuccess()
                                onOpenChange(false)
                            }, 1500)
                        } else if (res.code === 800) {
                            setStatus("expired")
                        } else if (res.code === 802) {
                            setStatus("scanning")
                        }
                    } else {
                        res = await accountService.checkKugouQR(qrKey, user.id)
                        // Kugou status: 0: expired, 1: waiting, 2: scanning, 4: success
                        if (res.status === 4) {
                            setStatus("success")
                            toast.success("酷狗音乐绑定成功")
                            setTimeout(() => {
                                onSuccess()
                                onOpenChange(false)
                            }, 1500)
                        } else if (res.status === 0) {
                            setStatus("expired")
                        } else if (res.status === 2) {
                            setStatus("scanning")
                        }
                    }
                } catch (error) {
                    console.error("Check QR status failed:", error)
                }
            }, 3000)
        }

        return () => {
            if (timer) clearInterval(timer)
        }
    }, [open, status, qrKey, user, platform, onOpenChange, onSuccess])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md flex flex-col items-center py-10">
                <DialogHeader className="w-full">
                    <DialogTitle className="text-center text-xl">
                        绑定{platform === "netease" ? "网易云音乐" : "酷狗音乐"}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        请使用{platform === "netease" ? "网易云音乐" : "酷狗音乐"} App 扫码登录
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-6 relative w-48 h-48 flex items-center justify-center bg-white rounded-xl overflow-hidden shadow-inner border">
                    {status === "loading" && (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">正在获取二维码...</span>
                        </div>
                    )}

                    {qrData && (status === "waiting" || status === "scanning" || status === "success") && (
                        <>
                            <img
                                src={qrData}
                                alt="QR Code"
                                className={`w-full h-full transition-opacity duration-300 p-2 ${status === "success" ? "opacity-20 grayscale" : "opacity-100"}`}
                            />
                            {status === "scanning" && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[1px]">
                                    <div className="p-3 bg-background rounded-full shadow-lg">
                                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                                    </div>
                                    <span className="mt-2 text-sm font-medium">扫码成功，请在手机上确认</span>
                                </div>
                            )}
                            {status === "success" && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="p-3 bg-green-500 rounded-full shadow-lg animate-in zoom-in duration-300">
                                        <CheckCircle2 className="h-10 w-10 text-white" />
                                    </div>
                                    <span className="mt-2 text-lg font-bold text-green-600">绑定成功</span>
                                </div>
                            )}
                        </>
                    )}

                    {status === "expired" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4 text-center">
                            <XCircle className="h-10 w-10 text-destructive mb-2" />
                            <span className="text-sm font-medium mb-3">二维码已过期</span>
                            <Button size="sm" onClick={fetchQR} className="h-8">
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                刷新二维码
                            </Button>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                            <XCircle className="h-10 w-10 text-destructive mb-2" />
                            <span className="text-sm font-medium text-destructive mb-2">{message}</span>
                            <Button size="sm" variant="outline" onClick={fetchQR}>重试</Button>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-sm text-muted-foreground text-center max-w-[280px]">
                    {status === "waiting" && "打开 APP -> 扫一扫 -> 确认登录"}
                    {status === "scanning" && "正在等待您的授权确认..."}
                    {status === "success" && "即将为您跳转..."}
                </div>

                <Button variant="ghost" className="mt-4" onClick={() => onOpenChange(false)}>
                    取消
                </Button>
            </DialogContent>
        </Dialog>
    )
}
