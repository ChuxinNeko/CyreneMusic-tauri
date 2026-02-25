"use client"

import React, { useState, useEffect } from "react"
import { audioEqService, EQ_FREQUENCIES, EQ_PRESETS } from "@/lib/services/audioEqService"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SlidersHorizontal, Settings2, RotateCcw, Headphones, Orbit } from "lucide-react"

export function EqualizerPanel() {
    const [enabled, setEnabled] = useState(false)
    const [presetIndex, setPresetIndex] = useState(0)
    const [bands, setBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

    // Spatial Audio State
    const [pan, setPan] = useState(0)
    const [surroundEnabled, setSurroundEnabled] = useState(false)
    const [surroundStrength, setSurroundStrength] = useState(0.5)

    useEffect(() => {
        // Load initial state
        setEnabled(audioEqService.isEnabled)
        setPresetIndex(audioEqService.activePresetIndex)
        setBands(audioEqService.currentBands)
        setPan(audioEqService.pan)
        setSurroundEnabled(audioEqService.isSurroundEnabled)
        setSurroundStrength(audioEqService.surround3DStrength)
    }, [])

    const handleEnableChange = (val: boolean) => {
        setEnabled(val)
        audioEqService.isEnabled = val
        audioEqService.refreshEqNodes()
    }

    const handlePresetChange = (value: string) => {
        const index = parseInt(value, 10)
        audioEqService.setPreset(index)
        setPresetIndex(index)
        setBands(audioEqService.currentBands)
    }

    const handleBandChange = (index: number, val: number[]) => {
        const gain = val[0]
        audioEqService.setBandGain(index, gain)
        setBands(audioEqService.currentBands)
        setPresetIndex(audioEqService.activePresetIndex)
    }

    const resetCustom = () => {
        audioEqService.setPreset(0) // Default flat preset
        setPresetIndex(0)
        setBands(audioEqService.currentBands)
    }

    const handlePanChange = (val: number[]) => {
        setPan(val[0])
        audioEqService.pan = val[0]
    }

    const handleSurroundToggle = (val: boolean) => {
        setSurroundEnabled(val)
        audioEqService.isSurroundEnabled = val
    }

    const handleSurroundStrengthChange = (val: number[]) => {
        setSurroundStrength(val[0])
        audioEqService.surround3DStrength = val[0]
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-6 bg-black/40 backdrop-blur-xl rounded-[24px] border border-white/10 shadow-2xl flex flex-col space-y-4 text-white min-h-[480px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-xl">
                        <Settings2 size={24} className="text-white/80" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">均衡器</h2>
                        <p className="text-xs text-white/50">10-Band Equalizer</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/70">
                            {enabled ? '已启用' : '已停用'}
                        </span>
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleEnableChange}
                        />
                    </div>
                </div>
            </div>

            <div className={`flex flex-col flex-1 transition-opacity duration-300 ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="flex items-center justify-between mb-8 px-2">
                    <Select value={presetIndex.toString()} onValueChange={handlePresetChange}>
                        <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white font-medium">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal size={14} className="opacity-70" />
                                <SelectValue placeholder="选择预设" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                            <SelectItem value="-1" disabled className="text-white/50">
                                自定义
                            </SelectItem>
                            {EQ_PRESETS.map((preset, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                    {preset.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {presetIndex === -1 && (
                        <button
                            onClick={resetCustom}
                            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/90 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full"
                        >
                            <RotateCcw size={12} />
                            重置
                        </button>
                    )}
                </div>

                <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 px-2 pb-4">
                    {EQ_FREQUENCIES.map((freq, i) => (
                        <div key={freq} className="flex flex-col items-center gap-2 group h-[160px] w-full max-w-[40px]">
                            <div className="text-[10px] font-mono text-white/40 h-4">
                                {bands[i] > 0 ? '+' : ''}{bands[i]}
                            </div>

                            <div className="relative flex-1 py-2 w-full flex justify-center">
                                {/* Slider Track Background */}
                                <div className="absolute inset-y-2 w-1.5 rounded-full bg-white/10" />

                                {/* 0dB middle line */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-white/20 z-0" />

                                <Slider
                                    orientation="vertical"
                                    value={[bands[i]]}
                                    min={-12}
                                    max={12}
                                    step={1}
                                    onValueChange={(val) => handleBandChange(i, val)}
                                    // Make sure slider uses available height while being centered
                                    className="h-full z-10"
                                    // @ts-ignore
                                    trackStyle={{ width: '6px', borderRadius: '4px' }}
                                    thumbStyle={{ width: '16px', height: '16px', backgroundColor: 'white', border: 'none', cursor: 'grab' }}
                                />
                            </div>

                            <div className="text-[10px] font-medium text-white/50 h-4">
                                {freq >= 1000 ? `${freq / 1000}k` : freq}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Spatial Audio Section */}
                <div className="pt-6 mt-2 border-t border-white/10 flex flex-col sm:flex-row gap-8">
                    {/* L/R Panning */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2">
                            <Headphones size={16} className="text-white/70" />
                            <span className="text-sm font-medium text-white/90">左右声道平衡</span>
                            <span className="ml-auto text-xs text-white/50 font-mono">
                                {pan < 0 ? `L ${Math.abs(Math.round(pan * 100))}%` : pan > 0 ? `R ${Math.round(pan * 100)}%` : 'Center'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-white/40 font-medium">L</span>
                            <Slider
                                value={[pan]}
                                min={-1}
                                max={1}
                                step={0.01}
                                onValueChange={handlePanChange}
                                className="flex-1"
                                variant="apple"
                            />
                            <span className="text-xs text-white/40 font-medium">R</span>
                        </div>
                    </div>

                    {/* 3D Surround */}
                    <div className="flex-1 space-y-4 border-l-0 sm:border-l border-white/10 sm:pl-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Orbit size={16} className={surroundEnabled ? "text-white" : "text-white/50"} />
                                <span className={`text-sm font-medium ${surroundEnabled ? 'text-white/90' : 'text-white/50'}`}>3D 环绕声</span>
                            </div>
                            <Switch
                                checked={surroundEnabled}
                                onCheckedChange={handleSurroundToggle}
                            />
                        </div>
                        <div className={`flex items-center gap-3 transition-opacity ${surroundEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <span className="text-xs text-white/40">强度</span>
                            <Slider
                                value={[surroundStrength]}
                                min={0}
                                max={1}
                                step={0.01}
                                onValueChange={handleSurroundStrengthChange}
                                className="flex-1"
                                variant="apple"
                            />
                            <span className="text-xs text-white/40 w-8 text-right font-mono">{Math.round(surroundStrength * 100)}%</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
