"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, RefreshCw, CheckCircle2, XCircle, Smartphone, QrCode } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { accountService } from "@/lib/services/accountService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { toast } from "sonner"
import QRCode from "qrcode"

interface QRCodeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    platform: "netease" | "kugou" | "qq"
    onSuccess: () => void
}

export function QRCodeDialog({ open, onOpenChange, platform, onSuccess }: QRCodeDialogProps) {
    const [qrData, setQrData] = useState<string | null>(null)
    const [qrKey, setQrKey] = useState<string | null>(null)
    const [qqTokens, setQqTokens] = useState<{ ptqrtoken: string; qrsig: string } | null>(null)
    const [status, setStatus] = useState<"loading" | "waiting" | "scanning" | "success" | "expired" | "error">("loading")
    const [message, setMessage] = useState("")
    const [loginTab, setLoginTab] = useState<"qr" | "phone">("qr")
    const { user, token } = useAuthStore()

    const fetchQR = useCallback(async () => {
        if (!open) return
        setStatus("loading")
        setQrData(null)
        setQrKey(null)
        setQqTokens(null)

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
            } else if (platform === "kugou") {
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
            } else if (platform === "qq") {
                const data = await accountService.getQqQRData()
                if (data && data.img) {
                    setQqTokens({ ptqrtoken: data.ptqrtoken, qrsig: data.qrsig })
                    setQrData(data.img)
                    setStatus("waiting")
                } else {
                    setStatus("error")
                    setMessage("获取QQ音乐扫码数据失败")
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
            setLoginTab("qr")
            fetchQR()
        }
    }, [open, fetchQR])

    useEffect(() => {
        let timer: NodeJS.Timeout
        if (open && loginTab === "qr" && status !== "success" && status !== "expired" && status !== "error" && user) {
            timer = setInterval(async () => {
                try {
                    let res
                    if (platform === "netease" && qrKey) {
                        res = await accountService.checkNeteaseQR(qrKey, user.id)
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
                    } else if (platform === "kugou" && qrKey) {
                        res = await accountService.checkKugouQR(qrKey, user.id)
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
                    } else if (platform === "qq" && qqTokens) {
                        res = await accountService.checkQqQR(qqTokens.ptqrtoken, qqTokens.qrsig, user.id)
                        if (res.code === 200) {
                            if (res.data?.isOk) {
                                setStatus("success")
                                toast.success("QQ音乐绑定成功")
                                setTimeout(() => {
                                    onSuccess()
                                    onOpenChange(false)
                                }, 1500)
                            } else if (res.data?.refresh) {
                                setStatus("expired")
                            } else if (res.data?.message?.includes("认证") || res.data?.message?.includes("扫描成功")) {
                                setStatus("scanning")
                            }
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
    }, [open, loginTab, status, qrKey, user, platform, onOpenChange, onSuccess])

    const platformName = platform === "netease" ? "网易云音乐" : platform === "kugou" ? "酷狗音乐" : "QQ音乐"

    const qrContent = (
        <>
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
        </>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md flex flex-col items-center py-10">
                <DialogHeader className="w-full">
                    <DialogTitle className="text-center text-xl">
                        绑定{platformName}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {loginTab === "phone" && platform === "netease"
                            ? "使用手机验证码登录网易云音乐"
                            : `请使用${platform === "netease" ? "网易云音乐" : platform === "kugou" ? "酷狗音乐" : "手机QQ"} App 扫码登录`}
                    </DialogDescription>
                </DialogHeader>

                {platform === "netease" ? (
                    <Tabs value={loginTab} onValueChange={(v) => setLoginTab(v as "qr" | "phone")} className="w-full flex flex-col items-center">
                        <TabsList className="mb-2">
                            <TabsTrigger value="qr" className="gap-1.5">
                                <QrCode className="h-4 w-4" />
                                扫码登录
                            </TabsTrigger>
                            <TabsTrigger value="phone" className="gap-1.5">
                                <Smartphone className="h-4 w-4" />
                                手机号登录
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="qr" className="flex flex-col items-center w-full">
                            {qrContent}
                        </TabsContent>

                        <TabsContent value="phone" className="w-full">
                            <PhoneLoginForm onSuccess={onSuccess} onClose={() => onOpenChange(false)} token={token} />
                        </TabsContent>
                    </Tabs>
                ) : (
                    qrContent
                )}

                <Button variant="ghost" className="mt-4" onClick={() => onOpenChange(false)}>
                    取消
                </Button>
            </DialogContent>
        </Dialog>
    )
}


// ==================== 手机号登录表单 ====================

interface PhoneLoginFormProps {
    onSuccess: () => void
    onClose: () => void
    token: string | null
}

function PhoneLoginForm({ onSuccess, onClose, token }: PhoneLoginFormProps) {
    const [phone, setPhone] = useState("")
    const [ctcode, setCtcode] = useState("86")
    const [captcha, setCaptcha] = useState("")
    const [countdown, setCountdown] = useState(0)
    const [isSending, setIsSending] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    const handleSendCaptcha = async () => {
        if (!phone.trim()) {
            toast.error("请输入手机号")
            return
        }
        setIsSending(true)
        try {
            const res = await accountService.sendNeteaseCaptcha(phone.trim(), ctcode || "86")
            if (res.code === 200) {
                toast.success("验证码已发送")
                setCountdown(60)
                timerRef.current = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev <= 1) {
                            if (timerRef.current) clearInterval(timerRef.current)
                            return 0
                        }
                        return prev - 1
                    })
                }, 1000)
            } else {
                toast.error(res.message || "发送验证码失败")
            }
        } catch {
            toast.error("发送验证码失败")
        } finally {
            setIsSending(false)
        }
    }

    const handleLogin = async () => {
        if (!phone.trim() || !captcha.trim()) {
            toast.error("请输入手机号和验证码")
            return
        }
        if (!token) {
            toast.error("请先登录 Cyrene 账户")
            return
        }
        setIsLoggingIn(true)
        try {
            const res = await accountService.loginNeteaseByCellphone(
                token,
                phone.trim(),
                captcha.trim(),
                ctcode || "86",
            )
            if (res.code === 200) {
                toast.success("网易云绑定成功")
                setTimeout(() => {
                    onSuccess()
                    onClose()
                }, 800)
            } else {
                toast.error(res.message || "登录失败，请检查验证码是否正确")
            }
        } catch {
            toast.error("登录失败")
        } finally {
            setIsLoggingIn(false)
        }
    }

    return (
        <div className="flex flex-col items-center gap-4 mt-6 w-full max-w-[280px] mx-auto">
            <div className="flex gap-2 w-full">
                <Input
                    value={ctcode}
                    onChange={(e) => setCtcode(e.target.value)}
                    placeholder="区号"
                    className="w-16 text-center"
                    maxLength={4}
                />
                <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="手机号"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && captcha.trim() && handleLogin()}
                />
            </div>

            <div className="flex gap-2 w-full">
                <Input
                    type="text"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value)}
                    placeholder="验证码"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 whitespace-nowrap"
                    disabled={countdown > 0 || isSending}
                    onClick={handleSendCaptcha}
                >
                    {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : countdown > 0 ? (
                        `${countdown}s`
                    ) : (
                        "获取验证码"
                    )}
                </Button>
            </div>

            <Button
                className="w-full"
                disabled={isLoggingIn || !phone.trim() || !captcha.trim()}
                onClick={handleLogin}
            >
                {isLoggingIn ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在绑定...
                    </>
                ) : (
                    "绑定网易云账号"
                )}
            </Button>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
                验证码将通过短信发送至您的手机，请勿泄露给他人。
            </p>
        </div>
    )
}