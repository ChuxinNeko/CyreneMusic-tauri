"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Heart, CreditCard, Loader2, CheckCircle2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { sponsorService } from "@/lib/services/sponsorService"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { useIsMobile } from "@/hooks/use-mobile"
import { QRCodeSVG } from "qrcode.react"

interface DonateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const PRESET_AMOUNTS = [
    { value: 3, label: "¥3", description: "来瓶可乐" },
    { value: 6, label: "¥6", description: "投喂面包" },
    { value: 10, label: "¥10", description: "名垂千古" },
]

const PAYMENT_METHODS = [
    {
        id: "alipay" as const,
        name: "支付宝",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500",
    },
    {
        id: "wxpay" as const,
        name: "微信支付",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500",
    },
]

type PaymentStep = "form" | "paying" | "success"

export function DonateDialog({ open, onOpenChange }: DonateDialogProps) {
    const [selectedAmount, setSelectedAmount] = useState(6)
    const [customAmount, setCustomAmount] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<"alipay" | "wxpay">("alipay")
    const [step, setStep] = useState<PaymentStep>("form")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [qrData, setQrData] = useState<string | null>(null)
    const [outTradeNo, setOutTradeNo] = useState<string | null>(null)
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const { user } = useAuthStore()
    const isMobile = useIsMobile()

    // 清理轮询定时器
    const clearPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
        }
    }, [])

    // 关闭时重置状态
    useEffect(() => {
        if (!open) {
            clearPolling()
            setStep("form")
            setSubmitting(false)
            setError(null)
            setQrData(null)
            setOutTradeNo(null)
            setCustomAmount("")
            setSelectedAmount(6)
            setPaymentMethod("alipay")
        }
    }, [open, clearPolling])

    // 组件卸载时清理
    useEffect(() => {
        return () => clearPolling()
    }, [clearPolling])

    const getEffectiveAmount = (): number | null => {
        if (customAmount.trim()) {
            const val = parseFloat(customAmount)
            if (isNaN(val) || val < 1) return null
            // 最多两位小数
            if (customAmount.includes(".") && customAmount.split(".")[1]?.length > 2) return null
            return val
        }
        return selectedAmount
    }

    // 开始轮询支付状态
    const startPolling = useCallback((tradeNo: string) => {
        clearPolling()
        let pollCount = 0
        const maxPolls = 120 // 最多轮询2分钟

        pollTimerRef.current = setInterval(async () => {
            pollCount++
            if (pollCount > maxPolls) {
                clearPolling()
                return
            }

            try {
                const result = await sponsorService.queryPayStatus(tradeNo)
                const status = result?.status
                if (status == 1 || status === "1") {
                    clearPolling()
                    setStep("success")
                }
            } catch {
                // 查询失败继续轮询
            }
        }, 3000) // 每3秒查询一次
    }, [clearPolling])

    const handleSubmit = async () => {
        const amount = getEffectiveAmount()
        if (!amount) {
            setError("请输入有效金额（最低 1 元，最多两位小数）")
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            // 1. 获取客户端 IP
            const ip = await sponsorService.getClientIp()
            if (!ip) {
                setError("获取 IP 地址失败，请稍后重试")
                setSubmitting(false)
                return
            }

            // 2. 生成订单号
            const tradeNo = sponsorService.generateOutTradeNo()
            setOutTradeNo(tradeNo)

            // 3. 如果已登录，先创建赞助记录
            if (user?.id) {
                try {
                    await sponsorService.createDonationRecord({
                        userId: user.id,
                        outTradeNo: tradeNo,
                        amount,
                        paymentType: paymentMethod,
                    })
                } catch {
                    // 创建记录失败不影响支付流程
                    console.warn("[DonateDialog] 创建赞助记录失败，继续支付流程")
                }
            }

            // 4. 创建支付订单
            const data = await sponsorService.createPayOrder({
                type: paymentMethod,
                money: amount.toFixed(2),
                name: `CyreneMusic赞助${amount.toFixed(0)}元`,
                clientip: ip,
                out_trade_no: tradeNo,
                device: isMobile ? "mobile" : "pc",
            })

            const ok = data?.code === 0 || data?.code === 1
            if (!ok) {
                setError(`下单失败: ${data?.msg || "未知错误"}`)
                setSubmitting(false)
                return
            }

            // 5. 获取支付数据
            const payInfo = data?.pay_info || data?.qrcode || data?.payurl || data?.urlscheme
            if (!payInfo) {
                setError("下单成功，但未返回支付数据")
                setSubmitting(false)
                return
            }

            if (isMobile) {
                // 移动端：新标签页打开支付链接
                window.open(payInfo, "_blank")
                setStep("paying")
                startPolling(tradeNo)
            } else {
                // 桌面端：展示二维码
                setQrData(payInfo)
                setStep("paying")
                startPolling(tradeNo)
            }
        } catch (e: any) {
            setError(`请求失败: ${e.message || "未知错误"}`)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px] gap-0">
                <DialogHeader className="pb-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        赞助支持
                    </DialogTitle>
                    <DialogDescription>
                        您的支持是我们持续改进的动力。赞助不影响任何功能。
                    </DialogDescription>
                </DialogHeader>

                {step === "form" && (
                    <div className="space-y-5">
                        {/* 提示信息 */}
                        <div className="text-sm text-primary font-medium bg-primary/5 rounded-lg px-3 py-2 border border-primary/10">
                            赞助任意金额，您的名字将被永久保留在赞助墙上 ✨
                        </div>

                        {/* 金额选择 */}
                        <div className="space-y-3">
                            <Label className="text-sm text-muted-foreground">选择金额</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {PRESET_AMOUNTS.map((preset) => {
                                    const isSelected = selectedAmount === preset.value && !customAmount.trim()
                                    return (
                                        <button
                                            key={preset.value}
                                            className={cn(
                                                "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all hover:bg-accent cursor-pointer",
                                                isSelected
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-muted"
                                            )}
                                            onClick={() => {
                                                setSelectedAmount(preset.value)
                                                setCustomAmount("")
                                                setError(null)
                                            }}
                                        >
                                            <span className="text-lg font-bold">{preset.label}</span>
                                            <span className="text-xs text-muted-foreground">{preset.description}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            <Input
                                type="number"
                                step="0.01"
                                min="1"
                                placeholder="自定义金额（元）"
                                value={customAmount}
                                onChange={(e) => {
                                    setCustomAmount(e.target.value)
                                    setError(null)
                                }}
                                className="h-10"
                            />
                        </div>

                        {/* 支付方式 */}
                        <div className="space-y-3">
                            <Label className="text-sm text-muted-foreground">支付方式</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {PAYMENT_METHODS.map((method) => {
                                    const isSelected = paymentMethod === method.id
                                    return (
                                        <button
                                            key={method.id}
                                            className={cn(
                                                "flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all cursor-pointer",
                                                isSelected
                                                    ? `${method.borderColor} ${method.bgColor}`
                                                    : "border-muted hover:bg-accent"
                                            )}
                                            onClick={() => setPaymentMethod(method.id)}
                                        >
                                            <CreditCard className={cn("h-4 w-4", method.color)} />
                                            <span className="font-medium text-sm">{method.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 错误提示 */}
                        {error && (
                            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                                {error}
                            </div>
                        )}

                        {/* 提交按钮 */}
                        <Button
                            className="w-full h-11"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    处理中...
                                </>
                            ) : (
                                <>
                                    <Heart className="h-4 w-4 mr-2" />
                                    立即赞助 ¥{getEffectiveAmount()?.toFixed(2) || "-.--"}
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {step === "paying" && (
                    <div className="flex flex-col items-center gap-5 py-4">
                        {/* 桌面端显示二维码 */}
                        {!isMobile && qrData && (
                            <>
                                <div className="text-sm text-muted-foreground">
                                    请使用{paymentMethod === "alipay" ? "支付宝" : "微信"}扫描下方二维码完成支付
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border">
                                    <QRCodeSVG
                                        value={qrData}
                                        size={200}
                                        level="M"
                                    />
                                </div>
                            </>
                        )}

                        {/* 移动端已跳转提示 */}
                        {isMobile && (
                            <>
                                <ExternalLink className="h-12 w-12 text-primary opacity-60" />
                                <div className="text-sm text-muted-foreground text-center">
                                    已打开支付页面，请在支付完成后返回此页面
                                </div>
                            </>
                        )}

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            等待支付结果...
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                clearPolling()
                                setStep("form")
                            }}
                        >
                            取消支付
                        </Button>
                    </div>
                )}

                {step === "success" && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                        <div className="text-lg font-semibold">感谢您的赞助！</div>
                        <div className="text-sm text-muted-foreground text-center">
                            您的名字将会出现在赞助墙上 💖
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            关闭
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
