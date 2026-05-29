import { Globe2 } from "lucide-react"

export interface LanguageStatItem {
    language: string
    playCount: number
    songCount: number
}

interface LanguageStatsSectionProps {
    languageStats: {
        languages: LanguageStatItem[]
        totalPlayCount: number
        totalSongCount: number
    } | null
}

export function LanguageStatsSection({ languageStats }: LanguageStatsSectionProps) {
    const items = languageStats?.languages || []
    const totalPlayCount = languageStats?.totalPlayCount || 0
    const totalSongCount = languageStats?.totalSongCount || 0

    // 按播放次数倒序排序
    const sortedItems = [...items].sort((a, b) => b.playCount - a.playCount)

    return (
        <div className="h-full flex flex-col space-y-4">
            {items.length > 0 ? (
                <div className="flex-1 relative bg-white dark:bg-zinc-900/40 rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/5 overflow-hidden">
                    {/* 水印标题 */}
                    <div className="absolute top-4 left-6 sm:left-8 text-2xl sm:text-[32px] font-black text-slate-100 dark:text-white/5 select-none tracking-tighter z-0 pointer-events-none">
                        本周听歌语言
                    </div>
                    
                    {/* 数据行 */}
                    <div className="relative z-10 flex gap-6 sm:gap-8 mt-12 overflow-x-auto scrollbar-hide pb-2">
                        {sortedItems.map((item) => {
                            const ratio = totalPlayCount > 0 ? item.playCount / totalPlayCount : 0
                            // 使用公式计算高度：最小高度16px，最大高度增加80px，完美模拟设计图的比例
                            const barHeight = 16 + ratio * 80 
                            const percentText = Math.round(ratio * 100)
                            
                            return (
                                <div key={item.language} className="flex flex-col flex-shrink-0 group">
                                    <div className="text-3xl sm:text-4xl font-black text-[#2A3143] dark:text-slate-200 tracking-tight">
                                        {percentText}%
                                    </div>
                                    <div className="text-[17px] sm:text-lg font-bold text-[#2A3143] dark:text-slate-200 mt-1">
                                        {item.language}
                                    </div>
                                    {/* 设定固定高度的容器并底部对齐，彻底解决排版问题 */}
                                    <div className="mt-4 sm:mt-5 h-[96px] flex items-end">
                                        <div 
                                            className="w-[72px] sm:w-[80px] rounded-[20px] bg-gradient-to-b from-primary to-primary/70 transition-all duration-500 ease-out group-hover:scale-105 origin-bottom"
                                            style={{ height: `${barHeight}px` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex-1 py-16 text-center bg-accent/5 rounded-[2rem] border-2 border-dashed border-accent/50 flex flex-col items-center justify-center">
                    <Globe2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-1">暂无语言数据</h3>
                    <p className="text-sm text-muted-foreground">播放更多歌曲后再来看看吧</p>
                </div>
            )}
            
            {/* 底部信息补充，放置在卡片外以保持卡片纯净 */}
            {items.length > 0 && (
                <div className="flex flex-wrap items-center justify-between px-2 text-[13px] text-muted-foreground/80 leading-[20px]">
                    <span>共计 {totalSongCount} 首，播放 {totalPlayCount} 次</span>
                    <span>仅统计已识别语种的歌曲</span>
                </div>
            )}
        </div>
    )
}