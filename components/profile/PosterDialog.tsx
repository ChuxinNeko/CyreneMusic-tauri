import { Dialog, DialogContent } from "@/components/ui/dialog"
import { motion } from "framer-motion"
import { Music2 } from "lucide-react"

interface PosterDialogProps {
    isOpen: boolean
    onClose: () => void
    weeklyPlays: any[] | null
    user: any
}

export function PosterDialog({ isOpen, onClose, weeklyPlays, user }: PosterDialogProps) {
    const topSongs = weeklyPlays?.slice(0, 5) || []
    const top1Song = topSongs[0]
    
    // 获取当前日期范围 (假设为本周)
    const getWeekRange = () => {
        const now = new Date()
        const dayOfWeek = now.getDay() || 7 // 1-7
        const monday = new Date(now)
        monday.setDate(now.getDate() - dayOfWeek + 1)
        const sunday = new Date(now)
        sunday.setDate(monday.getDate() + 6)
        
        const format = (d: Date) => `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`
        return `${format(monday)} - ${format(sunday)}`
    }

    const getArtistName = (song: any) => {
        if (!song) return '未知歌手'
        if (typeof song.artist_name === 'string') return song.artist_name
        if (typeof song.artist === 'string') return song.artist
        
        if (song.ar) {
            if (Array.isArray(song.ar)) return song.ar.map((a: any) => a.name || a).join('/')
            if (typeof song.ar === 'string') return song.ar
        }
        
        if (song.artists) {
            if (Array.isArray(song.artists)) return song.artists.map((a: any) => a.name || a).join('/')
            if (typeof song.artists === 'string') return song.artists
        }
        
        return '未知歌手'
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[400px] p-0 overflow-visible bg-transparent border-none shadow-none flex items-center justify-center">
                {/* Poster Container */}
                <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="relative w-[310px] sm:w-[340px] min-h-[560px] sm:min-h-[600px] h-auto rounded-[24px] overflow-hidden shadow-2xl text-white flex flex-col pointer-events-none bg-[#0a0a0a]"
                >
                    {/* Background Artwork */}
                    {top1Song && (top1Song.pic_url || top1Song.pic) && (
                        <div className="absolute inset-0 z-0">
                            <img 
                                src={top1Song.pic_url || top1Song.pic} 
                                alt="background" 
                                className="w-full h-full object-cover opacity-60 scale-125 blur-3xl saturate-150"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/70 to-[#0a0a0a]" />
                        </div>
                    )}
                    
                    {/* Noise Overlay */}
                    <div className="absolute inset-0 z-0 opacity-10 mix-blend-overlay pointer-events-none" 
                         style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
                    />

                    {/* Content Section */}
                    <div className="relative z-10 flex flex-col h-full p-5 sm:p-6">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 sm:mb-5">
                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10">
                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-primary to-primary/50 flex items-center justify-center overflow-hidden">
                                    {user?.avatarUrl ? (
                                        <img src={user.avatarUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <Music2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                    )}
                                </div>
                                <span className="text-[11px] sm:text-[12px] font-medium text-white/90">
                                    {user?.username || user?.nickname || user?.name || '听歌达人'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80">
                                <img src="/ico.png" alt="Logo" className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] rounded-sm object-cover grayscale brightness-200" />
                                <span className="font-bold text-[10px] sm:text-[11px] tracking-wider text-white">CYRENE</span>
                            </div>
                        </div>

                        {/* Title Section */}
                        <div className="flex flex-col mb-5 sm:mb-7">
                            <div className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] text-primary/90 uppercase mb-1 drop-shadow-md">
                                Weekly Report
                            </div>
                            <h1 className="text-[34px] sm:text-[38px] leading-[1.1] font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tighter drop-shadow-sm">
                                本周最爱<br/>唱片墙
                            </h1>
                        </div>

                        {/* Hero Album with Vinyl Effect */}
                        {top1Song && (
                            <div className="relative w-full mb-6 sm:mb-8 flex items-center justify-center h-[140px] sm:h-[150px]">
                                {/* Vinyl Record */}
                                <div className="absolute right-[6%] w-[130px] sm:w-[140px] aspect-square rounded-full bg-[#111] shadow-2xl border border-white/10 animate-[spin_10s_linear_infinite]"
                                     style={{ 
                                        background: 'radial-gradient(circle, #000 30%, #1a1a1a 40%, #000 50%, #1a1a1a 60%, #000 70%)'
                                     }}
                                >
                                    <div className="absolute inset-0 rounded-full border-[12px] sm:border-[15px] border-[#0a0a0a]/50 border-double opacity-50" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] aspect-square rounded-full border border-white/10 overflow-hidden bg-black flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full z-10" />
                                        <img src={top1Song.pic_url || top1Song.pic} className="absolute inset-0 w-full h-full object-cover opacity-80 blur-[1px]" />
                                    </div>
                                </div>
                                
                                {/* Album Cover */}
                                <div className="absolute left-[6%] w-[130px] sm:w-[140px] aspect-square rounded-xl shadow-[0_15px_30px_rgba(0,0,0,0.6)] border border-white/20 overflow-hidden z-10 bg-zinc-800 transform -rotate-3 transition-transform duration-500">
                                    {(top1Song.pic_url || top1Song.pic) ? (
                                        <img src={top1Song.pic_url || top1Song.pic} alt="Top 1" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
                                            <Music2 className="w-10 h-10 sm:w-12 sm:h-12 text-white/20" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Top Songs List */}
                        <div className="flex flex-col gap-3 sm:gap-3.5 flex-1 justify-end mb-4">
                            {topSongs.map((song, index) => (
                                <div key={index} className="flex items-center gap-3 w-full">
                                    <span className={`text-[13px] sm:text-[14px] font-black w-5 text-right font-mono ${index === 0 ? 'text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]' : 'text-white/40'}`}>
                                        {(index + 1).toString().padStart(2, '0')}
                                    </span>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="text-[13px] sm:text-[14px] font-bold text-white/95 truncate leading-tight">
                                            {song.track_name || song.name || '未知歌曲'}
                                        </div>
                                        <div className="text-[10px] sm:text-[11px] font-medium text-white/50 truncate mt-0.5">
                                            {getArtistName(song)}
                                        </div>
                                    </div>
                                    {/* Mini play count bar visualization */}
                                    {index === 0 && (
                                        <div className="flex items-end gap-[2px] sm:gap-[3px] h-3 sm:h-3.5 opacity-80">
                                            <div className="w-[2.5px] sm:w-[3px] h-[60%] bg-primary rounded-t-sm" />
                                            <div className="w-[2.5px] sm:w-[3px] h-[100%] bg-primary rounded-t-sm" />
                                            <div className="w-[2.5px] sm:w-[3px] h-[75%] bg-primary rounded-t-sm" />
                                            <div className="w-[2.5px] sm:w-[3px] h-[40%] bg-primary rounded-t-sm" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="mt-auto pt-3 sm:pt-4 border-t border-white/10 flex justify-between items-end">
                            <div className="flex flex-col gap-0.5 sm:gap-1">
                                <div className="text-[8px] sm:text-[9px] font-bold text-white/40 uppercase tracking-widest">
                                    Date Range
                                </div>
                                <div className="text-[10px] sm:text-[11px] font-mono text-white/70">
                                    {getWeekRange()}
                                </div>
                            </div>
                            
                            {/* Fake Barcode */}
                            <div className="flex items-end h-5 sm:h-6 gap-[1.5px] sm:gap-[2px] opacity-40 mix-blend-screen">
                                {[...Array(14)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="bg-white rounded-full"
                                        style={{
                                            width: Math.random() > 0.5 ? '2px' : '3px',
                                            height: `${Math.max(30, Math.random() * 100)}%`
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
                
                {/* Action Info (Optional, outside poster) */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-[12px] flex items-center gap-2 pointer-events-none tracking-widest font-medium">
                    <span className="animate-pulse">截图保存海报</span>
                </div>
            </DialogContent>
        </Dialog>
    )
}
