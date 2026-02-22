
"use client"

import React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { AudioQuality } from "@/lib/services/audioSourceService"
import { useAudioSourceStore } from "@/lib/store/useAudioSourceStore"

interface QualitySettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function QualitySettingsDialog({ open, onOpenChange }: QualitySettingsDialogProps) {
    const { quality, setQuality } = useAudioSourceStore()

    const qualities = [
        {
            value: AudioQuality.Standard,
            label: "标准音质",
            desc: "128kbps，节省流量，适合网络环境一般时使用",
        },
        {
            value: AudioQuality.ExHigh,
            label: "极高音质",
            desc: "320kbps，音质细腻，适合追求听感的听众",
        },
        {
            value: AudioQuality.Lossless,
            label: "无损音质",
            desc: "FLAC，CD级音质，完美还原音乐细节",
        },
        {
            value: AudioQuality.HiRes,
            label: "Hi-Res 音质",
            desc: "24bit/96kHz及以上，极致听觉体验",
        },
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>音质选择</DialogTitle>
                    <DialogDescription>
                        请选择您期望的默认播放音质，这取决于您的音源支持情况。
                    </DialogDescription>
                </DialogHeader>

                <RadioGroup
                    value={quality}
                    onValueChange={(value) => setQuality(value as AudioQuality)}
                    className="gap-4 py-4"
                >
                    {qualities.map((q) => (
                        <div key={q.value}>
                            <RadioGroupItem value={q.value} id={`quality-${q.value}`} className="peer sr-only" />
                            <Label
                                htmlFor={`quality-${q.value}`}
                                className="flex items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                            >
                                <div className="space-y-1">
                                    <div className="font-semibold">{q.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {q.desc}
                                    </div>
                                </div>
                                <div className="h-4 w-4 rounded-full border border-primary opacity-0 peer-data-[state=checked]:opacity-100 bg-primary" />
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </DialogContent>
        </Dialog>
    )
}
