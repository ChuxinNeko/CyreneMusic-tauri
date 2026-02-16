"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authService } from "@/lib/services/authService"
import { useAuthStore } from "@/lib/store/useAuthStore"

const loginSchema = z.object({
    account: z.string().min(1, "请输入账号"),
    password: z.string().min(1, "请输入密码"),
})

const registerSchema = z.object({
    email: z.string().email("请输入有效的邮箱"),
    username: z.string().min(2, "用户名至少2个字符"),
    password: z.string().min(6, "密码至少6个字符"),
    code: z.string().length(6, "验证码为6位"),
})

const resetSchema = z.object({
    email: z.string().email("请输入有效的邮箱"),
    code: z.string().length(6, "验证码为6位"),
    newPassword: z.string().min(6, "密码至少6个字符"),
})

interface AuthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

type AuthTab = "login" | "register" | "forgot"

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
    const [tab, setTab] = useState<AuthTab>("login")
    const login = useAuthStore((state) => state.login)
    const [isLoading, setIsLoading] = useState(false)
    const [isRegisterEnabled, setIsRegisterEnabled] = useState(true)
    const [countdown, setCountdown] = useState(0)

    // Forms
    const loginForm = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { account: "", password: "" },
    })

    const registerForm = useForm<z.infer<typeof registerSchema>>({
        resolver: zodResolver(registerSchema),
        defaultValues: { email: "", username: "", password: "", code: "" },
    })

    const resetForm = useForm<z.infer<typeof resetSchema>>({
        resolver: zodResolver(resetSchema),
        defaultValues: { email: "", code: "", newPassword: "" },
    })

    const handleTabChange = async (value: string) => {
        setTab(value as AuthTab)
        if (value === "register") {
            try {
                const res = await authService.checkRegistrationStatus()
                setIsRegisterEnabled(res.enabled)
            } catch (error) {
                console.error("Failed to check registration status:", error)
                setIsRegisterEnabled(true)
            }
        }
    }

    // Actions
    const onLogin = async (values: z.infer<typeof loginSchema>) => {
        setIsLoading(true)
        const res = await authService.login(values.account, values.password)
        setIsLoading(false)

        if (res.success && res.user) {
            const token = res.data?.token || ""
            login(res.user, token)
            toast.success("登录成功")
            onOpenChange(false)
        } else {
            toast.error(res.message || "登录失败")
        }
    }

    const onRegister = async (values: z.infer<typeof registerSchema>) => {
        setIsLoading(true)
        const res = await authService.register(values.email, values.username, values.password, values.code)
        setIsLoading(false)

        if (res.success) {
            toast.success("注册成功，请登录")
            setTab("login")
        } else {
            toast.error(res.message || "注册失败")
        }
    }

    const onReset = async (values: z.infer<typeof resetSchema>) => {
        setIsLoading(true)
        const res = await authService.resetPassword(values.email, values.code, values.newPassword)
        setIsLoading(false)

        if (res.success) {
            toast.success("密码重置成功，请登录")
            setTab("login")
        } else {
            toast.error(res.message || "重置失败")
        }

    }

    const sendCode = async (email: string, type: "register" | "reset") => {
        if (!email) {
            toast.error("请输入邮箱")
            return
        }

        setCountdown(60)
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        const res = type === "register"
            ? await authService.sendRegisterCode(email, registerForm.getValues("username"))
            : await authService.sendResetCode(email)

        if (res.success) {
            toast.success("验证码已发送")
        } else {
            toast.error(res.message || "发送失败")
            setCountdown(0)
            clearInterval(timer)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-center">
                        {tab === "login" && "登录 Cyrene Music"}
                        {tab === "register" && "注册新账号"}
                        {tab === "forgot" && "重置密码"}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {tab === "login" && "欢迎回来，请登录您的账号"}
                        {tab === "register" && "创建一个新账号加入我们要"}
                        {tab === "forgot" && "通过邮箱验证码重置您的密码"}
                    </DialogDescription>
                </DialogHeader>

                {tab === "forgot" ? (
                    <Form {...resetForm}>
                        <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                            <FormField
                                control={resetForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>邮箱</FormLabel>
                                        <FormControl>
                                            <Input placeholder="name@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex gap-2">
                                <FormField
                                    control={resetForm.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>验证码</FormLabel>
                                            <FormControl>
                                                <Input placeholder="6位验证码" {...field} maxLength={6} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-8"
                                    disabled={countdown > 0}
                                    onClick={() => sendCode(resetForm.getValues("email"), "reset")}
                                >
                                    {countdown > 0 ? `${countdown}s` : "获取验证码"}
                                </Button>
                            </div>
                            <FormField
                                control={resetForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>新密码</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="******" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                重置密码
                            </Button>
                            <div className="text-center text-sm">
                                <span className="cursor-pointer text-primary hover:underline" onClick={() => setTab("login")}>
                                    返回登录
                                </span>
                            </div>
                        </form>
                    </Form>
                ) : (
                    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">登录</TabsTrigger>
                            <TabsTrigger value="register">注册</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <Form {...loginForm}>
                                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                                    <FormField
                                        control={loginForm.control}
                                        name="account"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>账号</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="邮箱或用户名" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={loginForm.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>密码</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="******" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex justify-end">
                                        <span
                                            className="text-xs text-muted-foreground hover:text-primary cursor-pointer"
                                            onClick={() => setTab("forgot")}
                                        >
                                            忘记密码？
                                        </span>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        登录
                                    </Button>
                                </form>
                            </Form>
                        </TabsContent>

                        <TabsContent value="register">
                            {!isRegisterEnabled ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                                    <div className="p-3 bg-muted rounded-full">
                                        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-semibold">当前未开启注册</h3>
                                        <p className="text-sm text-muted-foreground">
                                            管理员暂时关闭了新用户注册功能。<br />
                                            请留意官方公告或稍后再试。
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={() => setTab("login")}>
                                        返回登录
                                    </Button>
                                </div>
                            ) : (
                                <Form {...registerForm}>
                                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                                        <FormField
                                            control={registerForm.control}
                                            name="username"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>用户名</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="设置用户名" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={registerForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>邮箱</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="name@example.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="flex gap-2">
                                            <FormField
                                                control={registerForm.control}
                                                name="code"
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <FormLabel>验证码</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="6位验证码" {...field} maxLength={6} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="mt-8"
                                                disabled={countdown > 0}
                                                onClick={() => sendCode(registerForm.getValues("email"), "register")}
                                            >
                                                {countdown > 0 ? `${countdown}s` : "获取验证码"}
                                            </Button>
                                        </div>
                                        <FormField
                                            control={registerForm.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>密码</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder="******" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" className="w-full" disabled={isLoading}>
                                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            注册
                                        </Button>
                                    </form>
                                </Form>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}
