"use client"

import { Howler } from 'howler'
import { audioEqService } from './audioEqService'

export interface FrequencyData {
    bass: number    // 低频能量 0-1 (20-300Hz)
    mid: number     // 中频能量 0-1 (300-2kHz)
    treble: number  // 高频能量 0-1 (2k-20kHz)
}

/**
 * 音频分析器 —— 通过 Web Audio API AnalyserNode 从 Howler.js
 * 的音频流中提取实时频率数据，用于驱动背景视觉律动效果。
 *
 * 关键：Howler.js html5 模式下，音频通过 <audio> 元素直接播放，
 * 不经过 Web Audio API 的 masterGain。因此需要使用
 * createMediaElementSource 将 <audio> 元素桥接到 Web Audio API。
 */
class AudioAnalyser {
    private static instance: AudioAnalyser
    private analyser: AnalyserNode | null = null
    private dataArray: Uint8Array<ArrayBuffer> | null = null
    private sourceNode: MediaElementAudioSourceNode | null = null
    private connectedElement: HTMLAudioElement | null = null
    private smoothBass = 0
    private smoothMid = 0
    private smoothTreble = 0
    private logCounter = 0

    // 平滑因子：值越小越平滑，越大越灵敏
    private readonly smoothUp = 0.35    // 上升平滑
    private readonly smoothDown = 0.15  // 下降平滑（保持视觉余韵）

    private constructor() { }

    static getInstance(): AudioAnalyser {
        if (!AudioAnalyser.instance) {
            AudioAnalyser.instance = new AudioAnalyser()
        }
        return AudioAnalyser.instance
    }

    /**
     * 连接到 Howl 实例的音频输出。
     * html5 模式下必须通过 createMediaElementSource 桥接到 Web Audio API。
     */
    connectToHowl(howl: any): void {
        try {
            const ctx = Howler.ctx
            if (!ctx) {
                console.warn('[AudioAnalyser] No AudioContext available')
                return
            }

            // 确保 AudioContext 处于运行状态
            if (ctx.state === 'suspended') {
                ctx.resume()
            }

            // 创建 AnalyserNode（复用）
            if (!this.analyser) {
                this.analyser = ctx.createAnalyser()
                this.analyser.fftSize = 512
                this.analyser.smoothingTimeConstant = 0.8
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
                // analyser → speakers
                this.analyser.connect(ctx.destination)
                console.log('[AudioAnalyser] AnalyserNode created, binCount:', this.analyser.frequencyBinCount)
            }

            // 获取 Howl 底层的 <audio> 元素
            const sounds = (howl as any)._sounds
            if (!sounds || sounds.length === 0) {
                console.warn('[AudioAnalyser] No sounds in Howl instance')
                return
            }

            const audioElement = sounds[0]._node as HTMLAudioElement
            if (!audioElement) {
                console.warn('[AudioAnalyser] No audio element found in Howl sound')
                return
            }

            // 如果是同一个 audio 元素，不需要重新连接
            if (this.connectedElement === audioElement) {
                console.log('[AudioAnalyser] Already connected to this audio element')
                return
            }

            // 断开旧的 source
            if (this.sourceNode) {
                try {
                    this.sourceNode.disconnect()
                } catch { /* ignore */ }
                this.sourceNode = null
            }

            // 关键：通过 createMediaElementSource 将 <audio> 桥接到 Web Audio API
            // 这会让音频流经过 Web Audio API，analyser 才能读取频率数据
            try {
                this.sourceNode = ctx.createMediaElementSource(audioElement)

                // 初始化 EQ 链 (如果尚未初始化)
                audioEqService.initEqChain()

                const eqInput = audioEqService.inputNode
                const eqOutput = audioEqService.outputNode

                if (eqInput && eqOutput) {
                    // 链路：audio element -> EQ Input -> [Filters...] -> EQ Output -> analyser -> destination (speakers)
                    this.sourceNode.connect(eqInput)
                    eqOutput.connect(this.analyser)
                    console.log('[AudioAnalyser] ✅ Connected via createMediaElementSource with EQ Chain')
                } else {
                    // Fallback 如果 EQ 初始化失败
                    this.sourceNode.connect(this.analyser)
                    console.log('[AudioAnalyser] ✅ Connected via createMediaElementSource (No EQ)')
                }

                this.connectedElement = audioElement
            } catch (e: any) {
                if (e.message?.includes('already been previously assigned')) {
                    // 该 audio 元素已被连接过（如切歌时旧的 Howl）
                    // Howler 在 html5 模式下可能复用 audio 元素
                    console.warn('[AudioAnalyser] Audio element already has a source, trying masterGain fallback')

                    // 回退：尝试从 Howler 内部的节点获取
                    const masterGain = (Howler as any).masterGain
                    if (masterGain) {
                        try {
                            masterGain.disconnect()

                            // 初始化 EQ 链
                            audioEqService.initEqChain()
                            const eqInput = audioEqService.inputNode
                            const eqOutput = audioEqService.outputNode

                            if (eqInput && eqOutput) {
                                masterGain.connect(eqInput)
                                eqOutput.connect(this.analyser)
                                console.log('[AudioAnalyser] Connected via masterGain fallback with EQ')
                            } else {
                                masterGain.connect(this.analyser)
                                console.log('[AudioAnalyser] Connected via masterGain fallback (No EQ)')
                            }
                        } catch (e2) {
                            console.error('[AudioAnalyser] masterGain fallback failed:', e2)
                        }
                    }
                } else {
                    console.error('[AudioAnalyser] createMediaElementSource error:', e)
                }
            }
        } catch (error) {
            console.error('[AudioAnalyser] Connection error:', error)
        }
    }

    /**
     * 获取当前帧的频率能量数据（已做平滑处理）。
     */
    getFrequencyData(): FrequencyData {
        if (!this.analyser || !this.dataArray) {
            if (this.logCounter++ % 300 === 0) {
                console.log('[AudioAnalyser] getFrequencyData: analyser not ready')
            }
            return { bass: 0, mid: 0, treble: 0 }
        }

        this.analyser.getByteFrequencyData(this.dataArray)

        const binCount = this.dataArray.length
        const sampleRate = this.analyser.context.sampleRate
        const binWidth = sampleRate / this.analyser.fftSize

        const bassEnd = Math.min(Math.ceil(300 / binWidth), binCount)
        const midEnd = Math.min(Math.ceil(2000 / binWidth), binCount)
        const trebleEnd = Math.min(Math.ceil(16000 / binWidth), binCount)

        let bassSum = 0, midSum = 0, trebleSum = 0

        for (let i = 0; i < bassEnd; i++) bassSum += this.dataArray[i]
        for (let i = bassEnd; i < midEnd; i++) midSum += this.dataArray[i]
        for (let i = midEnd; i < trebleEnd; i++) trebleSum += this.dataArray[i]

        const rawBass = bassEnd > 0 ? (bassSum / bassEnd) / 255 : 0
        const rawMid = (midEnd - bassEnd) > 0 ? (midSum / (midEnd - bassEnd)) / 255 : 0
        const rawTreble = (trebleEnd - midEnd) > 0 ? (trebleSum / (trebleEnd - midEnd)) / 255 : 0

        this.smoothBass = this.lerpSmooth(this.smoothBass, rawBass)
        this.smoothMid = this.lerpSmooth(this.smoothMid, rawMid)
        this.smoothTreble = this.lerpSmooth(this.smoothTreble, rawTreble)

        if (this.logCounter++ % 60 === 0) {
            console.log(`[AudioAnalyser] freq: bass=${rawBass.toFixed(3)} mid=${rawMid.toFixed(3)} treble=${rawTreble.toFixed(3)} | smooth: ${this.smoothBass.toFixed(3)} ${this.smoothMid.toFixed(3)} ${this.smoothTreble.toFixed(3)}`)
        }

        return {
            bass: this.smoothBass,
            mid: this.smoothMid,
            treble: this.smoothTreble,
        }
    }

    private lerpSmooth(current: number, target: number): number {
        const factor = target > current ? this.smoothUp : this.smoothDown
        return current + (target - current) * factor
    }

    dispose(): void {
        if (this.sourceNode) {
            try { this.sourceNode.disconnect() } catch { /* ignore */ }
            this.sourceNode = null
        }
        if (this.analyser) {
            try { this.analyser.disconnect() } catch { /* ignore */ }
            this.analyser = null
        }
        this.dataArray = null
        this.connectedElement = null
    }
}

export const audioAnalyser = AudioAnalyser.getInstance()
