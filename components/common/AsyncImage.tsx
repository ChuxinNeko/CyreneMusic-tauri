"use client"

import { useState, useEffect, useRef, HTMLAttributes } from "react"
import { Loader2, ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface AsyncImageProps extends HTMLAttributes<HTMLDivElement> {
    src?: string
    alt?: string
    className?: string
    imageClassName?: string
    aspectRatio?: "square" | "portrait" | "video"
    lazy?: boolean
}

export function AsyncImage({
    src,
    alt,
    className,
    imageClassName,
    aspectRatio = "square",
    lazy = true,
    ...props
}: AsyncImageProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(!src)
    const [isInView, setIsInView] = useState(!lazy)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!src) {
            setIsLoading(false)
            setError(true)
            return
        }

        // src 改变时重置状态
        setIsLoading(true)
        setError(false)

        if (!lazy) {
            setIsInView(true)
            return
        }

        // 如果开启了懒加载，则用 IntersectionObserver 监听
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setIsInView(true)
                            observer.disconnect()
                        }
                    })
                },
                {
                    // 设置一个较宽的 rootMargin，在视口外 200px 即提前触发预加载，确保滚动丝滑
                    rootMargin: "200px 0px",
                }
            )

            if (containerRef.current) {
                observer.observe(containerRef.current)
            }

            return () => {
                observer.disconnect()
            }
        } else {
            // 环境不支持时的回退策略
            setIsInView(true)
        }
    }, [src, lazy])

    const aspectRatioClass = {
        square: "aspect-square",
        portrait: "aspect-[3/4]",
        video: "aspect-video",
    }[aspectRatio]

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative overflow-hidden bg-muted flex items-center justify-center",
                aspectRatioClass,
                className
            )}
            {...props}
        >
            {/* 只有在进入视口且在加载中时才渲染旋转动画，避免视口外渲染大量运行中动画 */}
            {isInView && isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                </div>
            )}

            {error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                </div>
            ) : (
                // 只有在进入视口后才渲染图片元素，从而发起网络请求
                isInView && (
                    <img
                        src={src}
                        alt={alt}
                        className={cn(
                            "h-full w-full object-cover transition-opacity duration-700",
                            isLoading ? "opacity-0" : "opacity-100",
                            imageClassName
                        )}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                            setIsLoading(false)
                            setError(true)
                        }}
                    />
                )
            )}
        </div>
    )
}
