import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { AsyncImage } from "@/components/common/AsyncImage"
import { User } from "@/lib/services/authService"

interface ProfileHeaderProps {
    user: User | null
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
    return (
        <Card className="mt-8 border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden shadow-xl ring-1 ring-white/5">
            <div className="flex flex-col md:flex-row items-center gap-5 md:gap-6 p-5 md:p-7">
                <Avatar className="w-16 h-16 md:w-24 md:h-24 border-2 border-background shadow-lg transition-transform hover:scale-105 duration-500">
                    <AvatarImage src={user?.avatarUrl || ''} asChild>
                        <AsyncImage src={user?.avatarUrl || ''} />
                    </AvatarImage>
                    <AvatarFallback className="text-xl bg-muted">
                        {user?.username?.substring(0, 1) || 'U'}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 text-center md:text-left space-y-3">
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter leading-tight">
                            {user?.username || '用户'}
                        </h1>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground/80 font-medium text-xs">
                            {user?.email || 'Cyrene 音乐探索员'}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}
