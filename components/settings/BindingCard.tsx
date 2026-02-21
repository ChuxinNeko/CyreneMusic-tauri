"use client"

import { UserCircle2, ExternalLink, Link2, Link2Off, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface BindingCardProps {
    platform: "netease" | "kugou"
    name: string
    bound: boolean
    nickname?: string
    avatarUrl?: string
    onBind: () => void
    onUnbind: () => void
    isUnbinding?: boolean
}

export function BindingCard({
    platform,
    name,
    bound,
    nickname,
    avatarUrl,
    onBind,
    onUnbind,
    isUnbinding = false
}: BindingCardProps) {
    return (
        <Card className="overflow-hidden border-none shadow-none bg-accent/20 hover:bg-accent/30 transition-colors duration-200">
            <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative">
                            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-background shadow-sm">
                                <AvatarImage src={avatarUrl} alt={nickname || name} />
                                <AvatarFallback className="bg-primary/5 text-primary">
                                    {nickname ? nickname[0] : <UserCircle2 className="h-6 w-6" />}
                                </AvatarFallback>
                            </Avatar>
                            {bound && (
                                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-background">
                                    <CheckIcon className="h-2 w-2 text-white" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-base sm:text-lg truncate">{name}</h4>
                                {bound ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none h-5 px-1.5 text-[10px] font-bold">
                                        已绑定
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 h-5 px-1.5 text-[10px] font-bold">
                                        未绑定
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                                {bound ? nickname : `绑定账户以同步歌单和收藏`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {bound ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onUnbind}
                                disabled={isUnbinding}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 h-9"
                            >
                                {isUnbinding ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Link2Off className="h-4 w-4 mr-1.5" />
                                        解绑
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={onBind}
                                className="h-9 font-medium"
                            >
                                <Link2 className="h-4 w-4 mr-1.5" />
                                立即绑定
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function CheckIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    )
}
