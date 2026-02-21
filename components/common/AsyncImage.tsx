"use client"

import { useState, useEffect, HTMLAttributes } from "react"
import { Loader2, ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface AsyncImageProps extends HTMLAttributes<HTMLDivElement> {
    src?: string
    alt?: string
    className?: string
    imageClassName?: string
    aspectRatio?: "square" | "portrait" | "video"
}

export function AsyncImage({
    src,
    alt,
    className,
    imageClassName,
    aspectRatio = "square",
    ...props
}: AsyncImageProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(!src)

    useEffect(() => {
        if (!src) {
            setIsLoading(false)
            setError(true)
        }
    }, [src])

    const aspectRatioClass = {
        square: "aspect-square",
        portrait: "aspect-[3/4]",
        video: "aspect-video",
    }[aspectRatio]

    return (
        <div
            className={cn(
                "relative overflow-hidden bg-muted flex items-center justify-center",
                aspectRatioClass,
                className
            )}
            {...props}
        >
            {isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                </div>
            )}

            {error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                </div>
            ) : (
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
            )}
        </div>
    )
}
