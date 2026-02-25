"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
        variant?: "default" | "apple"
    }
>(({ className, variant = "default", ...props }, ref) => (
    <SliderPrimitive.Root
        ref={ref}
        className={cn(
            "relative flex touch-none select-none",
            props.orientation === "vertical" ? "h-full w-full flex-col items-center justify-center cursor-ns-resize" : "w-full items-center cursor-pointer group",
            className
        )}
        {...props}
    >
        <SliderPrimitive.Track className={cn(
            "relative overflow-hidden rounded-full transition-[width_height_background-color] duration-300",
            props.orientation === "vertical"
                ? "w-2 h-full bg-white/20 hover:w-3"
                : (variant === "apple" ? "h-1.5 w-full grow bg-white/20 group-hover:h-2" : "h-1.5 w-full grow bg-secondary group-hover:h-2.5")
        )}>
            <SliderPrimitive.Range className={cn(
                "absolute transition-colors",
                props.orientation === "vertical"
                    ? "w-full bottom-0"
                    : "h-full",
                variant === "apple" ? "bg-white/80" : "bg-primary group-hover:bg-primary/90"
            )} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={cn(
            "block rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            props.orientation === "vertical" ? "w-4 h-4 shadow-md bg-white border-none cursor-ns-resize" : "h-0 w-0 opacity-0"
        )} />
    </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
