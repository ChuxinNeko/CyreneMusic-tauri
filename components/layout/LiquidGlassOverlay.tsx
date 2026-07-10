"use client"

import LiquidGlass from "@nkzw/liquid-glass"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLayoutStore } from "@/lib/store/useLayoutStore"

export function LiquidGlassOverlay() {
    const isLiquidGlassVisible = useLayoutStore((state) => state.isLiquidGlassVisible)
    const hideLiquidGlass = useLayoutStore((state) => state.hideLiquidGlass)

    if (!isLiquidGlassVisible) {
        return null
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-[120]">
            <div className="pointer-events-auto fixed left-1/2 top-1/2 w-[min(92vw,860px)] -translate-x-1/2 -translate-y-1/2">
                <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-white/5 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur-3xl">
                    <LiquidGlass
                        className="bg-white/10"
                        displacementScale={72}
                        blurAmount={0.075}
                        saturation={145}
                        aberrationIntensity={2}
                        elasticity={0.22}
                        borderRadius={32}
                        padding="0"
                        style={{ position: "absolute", inset: 0 }}
                    >
                        <></>
                    </LiquidGlass>

                    <div className="relative z-10 flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                                Liquid Glass Preview
                            </div>
                            <h2 className="text-2xl font-semibold text-white">液态玻璃测试层</h2>
                            <p className="max-w-xl text-sm leading-6 text-white/70">
                                这是一个挂在全局布局上的液态玻璃遮罩层。切换页面时不会卸载，只有点击关闭按钮才会消失。
                            </p>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={hideLiquidGlass}
                            className="relative z-10 h-10 w-10 shrink-0 rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                            aria-label="关闭液态玻璃"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="relative z-10 mt-8 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/80">
                            <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                                挂载方式
                            </div>
                            全局挂载在 `MainLayout` 中，不依赖 `DEV` 页面生命周期。
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/80">
                            <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                                行为
                            </div>
                            页面切换后状态保持，直到你点击关闭按钮。
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}