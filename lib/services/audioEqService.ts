"use client"

import { Howler } from 'howler'

export interface EqBand {
    frequency: number
    gain: number
    type: BiquadFilterType
}

export interface EqPreset {
    name: string
    bands: number[] // 10 segment gains
}

// 标准 10 段 EQ 频率
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

export const EQ_PRESETS: EqPreset[] = [
    { name: '平坦', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: '流行', bands: [-2, -1, 0, 2, 3, 3, 2, 1, 0, -1] },
    { name: '摇滚', bands: [4, 3, 2, 0, -1, -1, 1, 2, 3, 4] },
    { name: '电子', bands: [4, 3, 1, -1, -2, 0, 1, 3, 4, 4] },
    { name: '古典', bands: [0, 0, 0, 0, 0, 0, -1, -2, -3, -4] },
    { name: '人声', bands: [-2, -1, 0, 1, 3, 3, 2, 0, -1, -2] },
    { name: '低音增强', bands: [6, 4, 2, 0, 0, 0, 0, 0, 0, 0] },
    { name: '高音增强', bands: [0, 0, 0, 0, 0, 0, 1, 2, 4, 6] },
]

class AudioEqService {
    private static instance: AudioEqService
    private filters: BiquadFilterNode[] = []
    private _inputNode: GainNode | null = null
    private _outputNode: GainNode | null = null
    private currentPresetIndex: number = 0
    private customBands: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    private isEqEnabled: boolean = false

    // Spatial Audio (Pan & 3D Surround)
    private _panNode: StereoPannerNode | null = null
    private currentPan: number = 0 // -1 (Left) to +1 (Right)

    // 3D Surround (Haas Effect)
    private surroundEnabled: boolean = false
    private surroundStrength: number = 0.5 // 0 to 1
    // Haas Effect nodes
    private surroundSplitter: ChannelSplitterNode | null = null
    private surroundMerger: ChannelMergerNode | null = null
    private surroundDelayL: DelayNode | null = null
    private surroundDelayR: DelayNode | null = null
    private surroundGainL: GainNode | null = null
    private surroundGainR: GainNode | null = null
    private surroundDryGain: GainNode | null = null
    private surroundWetGain: GainNode | null = null

    private constructor() {
        this.loadSettings()
    }

    static getInstance(): AudioEqService {
        if (!AudioEqService.instance) {
            AudioEqService.instance = new AudioEqService()
        }
        return AudioEqService.instance
    }

    /**
     * Initializes the BiquadFilterNode chain if not already setup
     * Returns true if successfully initialized or already initialized
     */
    initEqChain(): boolean {
        if (this._inputNode && this._outputNode && this.filters.length === 10) {
            return true // Already initialized
        }

        const ctx = Howler.ctx
        if (!ctx) return false

        try {
            // Create Input and Output boundaries for the EQ chain
            this._inputNode = ctx.createGain()
            this._outputNode = ctx.createGain()

            // Define 10 bands
            this.filters = EQ_FREQUENCIES.map((freq, index) => {
                const filter = ctx.createBiquadFilter()

                // lowshelf for the lowest, highshelf for the highest, peaking for the rest
                if (index === 0) filter.type = 'lowshelf'
                else if (index === EQ_FREQUENCIES.length - 1) filter.type = 'highshelf'
                else filter.type = 'peaking'

                filter.frequency.value = freq
                filter.Q.value = 1.0 // Standard Q factor

                return filter
            })

            // Connect the chain: input -> filter0 -> filter1 -> ... -> filter9 -> ...
            this._inputNode.connect(this.filters[0])
            for (let i = 0; i < this.filters.length - 1; i++) {
                this.filters[i].connect(this.filters[i + 1])
            }

            // Spatial Audio Nodes
            // 1. Pan Node
            this._panNode = ctx.createStereoPanner()

            // 2. Haas 3D Surround Sub-graph
            // We split the signal into L and R, apply cross-delays, and mix them back
            this.surroundSplitter = ctx.createChannelSplitter(2)
            this.surroundMerger = ctx.createChannelMerger(2)

            this.surroundDelayL = ctx.createDelay()
            this.surroundDelayR = ctx.createDelay()

            this.surroundGainL = ctx.createGain()
            this.surroundGainR = ctx.createGain()

            this.surroundDryGain = ctx.createGain()
            this.surroundWetGain = ctx.createGain()

            // Setup Haas Effect connections
            // Dry path (unaltered original signal)
            this._panNode.connect(this.surroundDryGain)
            this.surroundDryGain.connect(this._outputNode)

            // Wet path (3D effect)
            this._panNode.connect(this.surroundSplitter)

            // Left channel goes to Right with delay
            this.surroundSplitter.connect(this.surroundDelayL, 0)
            this.surroundDelayL.connect(this.surroundGainL)
            this.surroundGainL.connect(this.surroundMerger, 0, 1) // Connect to Right channel of merger

            // Right channel goes to Left with delay
            this.surroundSplitter.connect(this.surroundDelayR, 1)
            this.surroundDelayR.connect(this.surroundGainR)
            this.surroundGainR.connect(this.surroundMerger, 0, 0) // Connect to Left channel of merger

            // Wet Gain control
            this.surroundMerger.connect(this.surroundWetGain)
            this.surroundWetGain.connect(this._outputNode)

            // Finalizing the main chain:  EQ -> Pan -> Haas -> Output
            this.filters[this.filters.length - 1].connect(this._panNode)

            this.applyCurrentSettingsToNodes()
            this.applySpatialSettings()
            return true
        } catch (error) {
            console.error('[AudioEqService] Failed to initialize EQ chain', error)
            return false
        }
    }

    get inputNode(): GainNode | null {
        return this._inputNode
    }

    get outputNode(): GainNode | null {
        return this._outputNode
    }

    get isEnabled(): boolean {
        return this.isEqEnabled
    }

    set isEnabled(enabled: boolean) {
        this.isEqEnabled = enabled
        this.saveSettings()
    }

    get activePresetIndex(): number {
        return this.currentPresetIndex
    }

    get currentBands(): number[] {
        if (this.currentPresetIndex === -1) {
            return [...this.customBands]
        }
        return [...EQ_PRESETS[this.currentPresetIndex].bands]
    }

    setPreset(index: number) {
        if (index >= -1 && index < EQ_PRESETS.length) {
            this.currentPresetIndex = index
            this.applyCurrentSettingsToNodes()
            this.saveSettings()
        }
    }

    setBandGain(bandIndex: number, gain: number) {
        if (bandIndex >= 0 && bandIndex < 10) {
            // If we modify a band, we switch to custom preset (-1)
            // But first, if we were on a preset, copy its values to custom
            if (this.currentPresetIndex !== -1) {
                this.customBands = [...EQ_PRESETS[this.currentPresetIndex].bands]
                this.currentPresetIndex = -1
            }

            this.customBands[bandIndex] = gain
            this.applyCurrentSettingsToNodes()
            this.saveSettings()
        }
    }

    // --- Spatial Audio API ---
    get pan(): number {
        return this.currentPan
    }

    set pan(value: number) {
        this.currentPan = Math.max(-1, Math.min(1, value))
        if (this._panNode) {
            this._panNode.pan.value = this.currentPan
        }
        this.saveSettings()
    }

    get isSurroundEnabled(): boolean {
        return this.surroundEnabled
    }

    set isSurroundEnabled(enabled: boolean) {
        this.surroundEnabled = enabled
        this.applySpatialSettings()
        this.saveSettings()
    }

    get surround3DStrength(): number {
        return this.surroundStrength
    }

    set surround3DStrength(value: number) {
        this.surroundStrength = Math.max(0, Math.min(1, value))
        this.applySpatialSettings()
        this.saveSettings()
    }

    private applySpatialSettings() {
        if (!this._panNode) return
        this._panNode.pan.value = this.currentPan

        if (this.surroundDryGain && this.surroundWetGain && this.surroundDelayL && this.surroundDelayR && this.surroundGainL && this.surroundGainR) {
            if (this.surroundEnabled) {
                // Haas effect parameters: 15-30ms delay is typical for widening without echo
                const delayTimeL = 0.020 + (this.surroundStrength * 0.015) // 20ms to 35ms
                const delayTimeR = 0.025 + (this.surroundStrength * 0.015) // Slightly different for R

                this.surroundDelayL.delayTime.value = delayTimeL
                this.surroundDelayR.delayTime.value = delayTimeR

                // The wet gain increases with strength feeling
                this.surroundGainL.gain.value = 0.5 * this.surroundStrength
                this.surroundGainR.gain.value = 0.5 * this.surroundStrength

                this.surroundWetGain.gain.value = 1.0
                // Reduce dry gain slightly so the overall volume doesn't clip as much
                this.surroundDryGain.gain.value = 1.0 - (this.surroundStrength * 0.3)
            } else {
                this.surroundWetGain.gain.value = 0
                this.surroundDryGain.gain.value = 1.0
            }
        }
    }

    private applyCurrentSettingsToNodes() {
        if (!this.filters.length) return

        const targetBands = this.currentPresetIndex === -1
            ? this.customBands
            : EQ_PRESETS[this.currentPresetIndex].bands

        // Apply values to the filters
        for (let i = 0; i < this.filters.length; i++) {
            if (this.filters[i]) {
                const newValue = this.isEqEnabled ? targetBands[i] : 0
                this.filters[i].gain.value = newValue
            }
        }
    }

    /**
     * Re-applies gains when EQ is toggled
     */
    refreshEqNodes() {
        this.applyCurrentSettingsToNodes()
    }

    private saveSettings() {
        if (typeof window !== 'undefined') {
            try {
                const settings = {
                    enabled: this.isEqEnabled,
                    presetIndex: this.currentPresetIndex,
                    customBands: this.customBands,
                    pan: this.currentPan,
                    surroundEnabled: this.surroundEnabled,
                    surroundStrength: this.surroundStrength
                }
                localStorage.setItem('audio_eq_settings', JSON.stringify(settings))
            } catch (e) {
                console.warn('[AudioEqService] Failed to save settings', e)
            }
        }
    }

    private loadSettings() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('audio_eq_settings')
                if (saved) {
                    const settings = JSON.parse(saved)
                    this.isEqEnabled = !!settings.enabled
                    this.currentPresetIndex = settings.presetIndex !== undefined ? settings.presetIndex : 0
                    this.customBands = settings.customBands ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                    this.currentPan = settings.pan ?? 0
                    this.surroundEnabled = !!settings.surroundEnabled
                    this.surroundStrength = settings.surroundStrength ?? 0.5
                }
            } catch (e) {
                console.warn('[AudioEqService] Failed to load settings', e)
            }
        }
    }
}

export const audioEqService = AudioEqService.getInstance()
