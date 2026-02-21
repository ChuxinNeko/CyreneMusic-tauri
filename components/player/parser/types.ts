export interface WordData {
    text: string
    startTime: number
    endTime: number
    duration: number
}

export interface LyricLineData {
    time: number
    endTime: number
    startTime: number
    words: WordData[]
    isVerbatim: boolean
    translation?: string
}
