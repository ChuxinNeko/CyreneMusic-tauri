import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { User } from "@/lib/services/authService"

interface ProfileHeaderProps {
    user: User | null
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
    return (
        <div className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl mt-4 md:mt-8 ring-1 ring-border/10">
            {/* Background Layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background z-0" />
            {user?.avatarUrl && (
                <div 
                    className="absolute inset-0 opacity-20 blur-[60px] z-0 scale-110 saturate-150" 
                    style={{ backgroundImage: `url(${user.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
                />
            )}
            <div className="absolute inset-0 bg-background/40 backdrop-blur-sm z-0" />

            {/* Content */}
            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
                <Avatar className="w-28 h-28 md:w-40 md:h-40 border-4 border-background shadow-2xl transition-transform hover:scale-105 duration-500">
                    <AvatarImage
                        src={user?.avatarUrl}
                        alt={user?.username}
                        className="object-cover"
                    />
                    <AvatarFallback className="text-4xl bg-muted font-bold text-muted-foreground">
                        {user?.username?.substring(0, 1) || 'U'}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 text-center md:text-left space-y-3 mb-2 md:mb-4">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground drop-shadow-sm">
                        {user?.username || '用户'}
                    </h1>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm shadow-sm">
                        {user?.email || 'Cyrene 音乐探索员'}
                    </div>
                </div>
            </div>
        </div>
    )
}
