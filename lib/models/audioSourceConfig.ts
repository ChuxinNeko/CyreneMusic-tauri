
export enum AudioSourceType {
    OmniParse = 0,   // OmniParse 音源（兼容现有后端格式）
    LxMusic = 1,     // 洛雪音乐音源
    TuneHub = 2,     // TuneHub 音源（公开 API）
}

export interface AudioSourceConfig {
    /** Unique ID */
    id: string;

    /** Source Type */
    type: AudioSourceType;

    /** Display Name */
    name: string;

    /** Base API URL */
    url: string;

    /** API Key (optional) */
    apiKey: string;

    /** 支持的搜索平台列表 */
    supportedPlatforms: string[];

    // --- LxMusic Specific Fields ---
    version: string;
    author: string;
    description: string;
    scriptSource: string;
    scriptContent: string;
    urlPathTemplate: string;
}
