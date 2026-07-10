import React from "react"
import { usePlayerStore } from "@/lib/store/usePlayerStore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Box, Eye } from "lucide-react"

interface DesktopLyricEffectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DesktopLyricEffectDialog({ open, onOpenChange }: DesktopLyricEffectDialogProps) {
    const desktopLyricRotationX = usePlayerStore(s => s.desktopLyricRotationX)
    const setDesktopLyricRotationX = usePlayerStore(s => s.setDesktopLyricRotationX)
    
    const desktopLyricRotationY = usePlayerStore(s => s.desktopLyricRotationY)
    const setDesktopLyricRotationY = usePlayerStore(s => s.setDesktopLyricRotationY)
    
    const desktopLyricRotationZ = usePlayerStore(s => s.desktopLyricRotationZ)
    const setDesktopLyricRotationZ = usePlayerStore(s => s.setDesktopLyricRotationZ)
    
    const desktopLyricPerspective = usePlayerStore(s => s.desktopLyricPerspective)
    const setDesktopLyricPerspective = usePlayerStore(s => s.setDesktopLyricPerspective)
    
    // Preview Styles
    const desktopLyricFontSize = usePlayerStore(s => s.desktopLyricFontSize)
    const desktopLyricColor = usePlayerStore(s => s.desktopLyricColor)
    const desktopLyricStrokeColor = usePlayerStore(s => s.desktopLyricStrokeColor)
    const lyricFontFamily = usePlayerStore(s => s.lyricFontFamily)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-black/80 backdrop-blur-xl border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-white/70" />
                        桌面歌词 3D 效果
                    </DialogTitle>
                    <DialogDescription className="text-white/50">
                        调整桌面歌词的3D翻转与透视效果，实时生效。
                    </DialogDescription>
                </DialogHeader>

                {/* Lyric Preview Window */}
                <div 
                    className="w-full h-32 mt-2 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center overflow-hidden relative shadow-inner"
                    style={{ perspective: `${desktopLyricPerspective}px`, transformStyle: 'preserve-3d' }}
                >
                    <div 
                        className="transition-transform duration-300 ease-out origin-center"
                        style={{
                            transform: `rotateX(${desktopLyricRotationX}deg) rotateY(${desktopLyricRotationY}deg) rotateZ(${desktopLyricRotationZ}deg)`
                        }}
                    >
                        <span 
                            className="font-black whitespace-nowrap tracking-wide drop-shadow-md"
                            style={{
                                fontSize: `${Math.max(20, desktopLyricFontSize * 0.6)}px`, // scaled for preview
                                color: desktopLyricColor,
                                WebkitTextStroke: `1px ${desktopLyricStrokeColor}`,
                                fontFamily: lyricFontFamily
                            }}
                        >
                            这是一句示例歌词
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-6 pt-2 pb-4">
                    {/* X Axis Rotation */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-medium opacity-80">
                            <span>X轴旋转 (前后倾斜)</span>
                            <span className="text-white/60 w-12 text-right">{desktopLyricRotationX}°</span>
                        </div>
                        <Slider
                            value={[desktopLyricRotationX]}
                            min={-90}
                            max={90}
                            step={1}
                            onValueChange={(v) => setDesktopLyricRotationX(v[0])}
                            className="w-full"
                        />
                    </div>

                    {/* Y Axis Rotation */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-medium opacity-80">
                            <span>Y轴旋转 (左右倾斜)</span>
                            <span className="text-white/60 w-12 text-right">{desktopLyricRotationY}°</span>
                        </div>
                        <Slider
                            value={[desktopLyricRotationY]}
                            min={-90}
                            max={90}
                            step={1}
                            onValueChange={(v) => setDesktopLyricRotationY(v[0])}
                            className="w-full"
                        />
                    </div>

                    {/* Z Axis Rotation */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-medium opacity-80">
                            <span>Z轴旋转 (平面旋转)</span>
                            <span className="text-white/60 w-12 text-right">{desktopLyricRotationZ}°</span>
                        </div>
                        <Slider
                            value={[desktopLyricRotationZ]}
                            min={-180}
                            max={180}
                            step={1}
                            onValueChange={(v) => setDesktopLyricRotationZ(v[0])}
                            className="w-full"
                        />
                    </div>

                    {/* Perspective */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-medium opacity-80">
                            <span className="flex items-center gap-2"><Eye className="w-4 h-4" /> 3D视距 (透视)</span>
                            <span className="text-white/60 w-16 text-right">{desktopLyricPerspective}px</span>
                        </div>
                        <Slider
                            value={[desktopLyricPerspective]}
                            min={200}
                            max={3000}
                            step={50}
                            onValueChange={(v) => setDesktopLyricPerspective(v[0])}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-end mt-2">
                        <button 
                            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors"
                            onClick={() => {
                                setDesktopLyricRotationX(0)
                                setDesktopLyricRotationY(0)
                                setDesktopLyricRotationZ(0)
                                setDesktopLyricPerspective(1000)
                            }}
                        >
                            重置为默认
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
