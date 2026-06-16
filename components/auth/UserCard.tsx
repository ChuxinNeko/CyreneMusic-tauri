"use client"

import { User as UserIcon, Mail, MapPin, Crown, LogOut, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { useUIThemeStore } from "@/lib/store/useUIThemeStore"
import { cn } from "@/lib/utils"
import {
    Card as FluentCard,
    Button as FluentButton,
    Text,
    Avatar as FluentAvatar,
    Badge as FluentBadge,
} from "@fluentui/react-components"

interface UserCardProps {
    onLoginClick?: () => void
    className?: string
}

export function UserCard({ onLoginClick, className }: UserCardProps) {
    const { user, isLoggedIn, logout } = useAuthStore()
    const { currentTheme } = useUIThemeStore()
    const isFluent = currentTheme === "fluent"

    /* ========================= Fluent 主题分支 ========================= */
    if (isFluent) {
        // 公共卡片容器样式（与 SettingsItem fluent 分支一致）
        const cardClass = cn(
            "w-full bg-white/95 dark:bg-[#2d2d2d]/85 backdrop-blur-2xl",
            "border border-black/[0.05] dark:border-white/[0.08]",
            "rounded-lg shadow-sm transition-colors",
            "hover:bg-neutral-50 dark:hover:bg-[#383838]/85",
            className
        )

        if (!isLoggedIn) {
            return (
                <FluentCard className={cn(cardClass, "p-6")} appearance="subtle">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-md shadow-inner">
                            <UserIcon className="h-10 w-10 text-neutral-400 dark:text-neutral-500" />
                        </div>
                        <div className="space-y-1">
                            <Text as="h3" className="block text-xl font-bold tracking-tight">
                                发现更多精彩
                            </Text>
                            <Text as="p" size={300} className="block max-w-[200px] text-neutral-500 dark:text-neutral-400">
                                登录您的账号以同步歌单、查看听歌排行及更多个性化推荐
                            </Text>
                        </div>
                        <FluentButton
                            appearance="primary"
                            className="w-full h-11 font-medium rounded-md"
                            onClick={onLoginClick}
                            icon={<LogIn className="w-4 h-4" />}
                        >
                            立即登录
                        </FluentButton>
                    </div>
                </FluentCard>
            )
        }

        // Fluent - 已登录
        const name = user?.username ?? ""
        return (
            <FluentCard className={cn(cardClass, "p-6")} appearance="subtle">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative">
                        {user?.avatarUrl ? (
                            <Avatar className="h-[72px] w-[72px] border-2 border-black/[0.05] dark:border-white/[0.08] shadow-md rounded-full">
                                <AvatarImage src={user?.avatarUrl} alt={name} className="object-cover" />
                                <AvatarFallback className="bg-neutral-100 dark:bg-neutral-800 text-2xl font-bold">
                                    {name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <FluentAvatar name={name} size={72} className="shadow-md" />
                        )}
                        {user?.isSponsor && (
                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-yellow-500 text-white rounded-full shadow-lg ring-2 ring-white dark:ring-[#2d2d2d]">
                                <Crown className="w-3.5 h-3.5" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col items-center sm:items-start space-y-3 text-center sm:text-left min-w-0">
                        <div className="space-y-1 w-full">
                            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                <Text as="h3" className="text-2xl font-bold tracking-tight truncate max-w-[200px]">
                                    {name}
                                </Text>
                                {user?.isSponsor && (
                                    <FluentBadge appearance="filled" color="warning">
                                        SPONSOR
                                    </FluentBadge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                                <div className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" />
                                    <span className="truncate max-w-[150px]">{user?.email}</span>
                                </div>
                                {user?.ipLocation && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span>IP: {user.ipLocation}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <FluentButton
                                appearance="outline"
                                size="small"
                                className="rounded-md"
                                onClick={logout}
                                icon={<LogOut className="w-3.5 h-3.5" />}
                            >
                                退出登录
                            </FluentButton>
                        </div>
                    </div>
                </div>
            </FluentCard>
        )
    }

    /* ========================= Shadcn 主题分支（保持原样） ========================= */
    if (!isLoggedIn) {
        return (
            <div className={cn(
                "relative overflow-hidden group p-6 bg-card border rounded-2xl transition-all duration-300 shadow-sm hover:shadow-xl hover:border-primary/20",
                className
            )}>
                {/* Background decorative elements */}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                    <div className="p-4 bg-muted rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <UserIcon className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold tracking-tight">发现更多精彩</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                            登录您的账号以同步歌单、查看听歌排行及更多个性化推荐
                        </p>
                    </div>
                    <Button
                        onClick={onLoginClick}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-xl h-11 font-medium transition-all active:scale-[0.98]"
                    >
                        <LogIn className="w-4 h-4 mr-2" />
                        立即登录
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className={cn(
            "relative overflow-hidden group p-6 bg-card border rounded-2xl transition-all duration-300 shadow-sm hover:shadow-xl hover:border-primary/20",
            className
        )}>
            {/* Ambient Background */}
            <div className="absolute -right-4 -top-4 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                <div className="relative group/avatar">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-primary-foreground opacity-20 rounded-full blur translate-y-1 group-hover/avatar:opacity-40 transition-opacity" />
                    <Avatar className="h-20 w-20 border-2 border-background shadow-xl rounded-full relative">
                        <AvatarImage src={user?.avatarUrl} alt={user?.username} className="object-cover" />
                        <AvatarFallback className="bg-muted text-2xl font-bold">
                            {user?.username?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    {user?.isSponsor && (
                        <div className="absolute -bottom-1 -right-1 p-1.5 bg-yellow-500 text-white rounded-full shadow-lg ring-2 ring-background animate-bounce-subtle">
                            <Crown className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col items-center sm:items-start space-y-3 text-center sm:text-left min-w-0">
                    <div className="space-y-1 w-full">
                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                            <h3 className="text-2xl font-bold tracking-tight truncate max-w-[200px]">
                                {user?.username}
                            </h3>
                            {user?.isSponsor && (
                                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 px-2 py-0 text-[10px] uppercase font-bold tracking-wider">
                                    SPONSOR
                                </Badge>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[150px]">{user?.email}</span>
                            </div>
                            {user?.ipLocation && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>IP: {user.ipLocation}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={logout}
                            className="rounded-xl px-4 border-muted-foreground/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all active:scale-[0.98]"
                        >
                            <LogOut className="w-3.5 h-3.5 mr-2" />
                            退出登录
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
