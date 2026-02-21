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
            "relative flex w-full touch-none select-none items-center group cursor-pointer",
            className
        )}
        {...props}
    >
        <SliderPrimitive.Track className={cn(
            "relative h-1.5 w-full grow overflow-hidden rounded-full transition-[height_background-color] duration-300",
            variant === "apple" ? "bg-white/20 group-hover:h-2" : "bg-secondary group-hover:h-2.5"
        )}>
            <SliderPrimitive.Range className={cn(
                "absolute h-full transition-colors",
                variant === "apple" ? "bg-white/80" : "bg-primary group-hover:bg-primary/90"
            )} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-0 w-0 opacity-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
