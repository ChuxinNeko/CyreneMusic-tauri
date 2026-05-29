
import { AudioSourceConfig, AudioSourceType } from '../models/audioSourceConfig';

/**
 * 音质枚举 (映射自 Flutter 中的 AudioQuality)
 */
export enum AudioQuality {
    Standard = 'standard',
    ExHigh = 'exhigh',
    Lossless = 'lossless',
    HiRes = 'hires',
}

/**
 * 音乐来源枚举 (映射自 Flutter 中的 MusicSource)
 */
export enum MusicSource {
    Netease = 'netease',
    QQ = 'qq',
    Kugou = 'kugou',
    Kuwo = 'kuwo',
    Apple = 'apple',
    Spotify = 'spotify',
    Qishui = 'qishui',
    Local = 'local'
}

class AudioSourceService {
    private static instance: AudioSourceService;

    private constructor() { }

    public static getInstance(): AudioSourceService {
        if (!AudioSourceService.instance) {
            AudioSourceService.instance = new AudioSourceService();
        }
        return AudioSourceService.instance;
    }

    /**
     * 洛雪音源来源代码映射
     */
    private readonly lxSourceCodeMap: Record<string, string> = {
        [MusicSource.Netease]: 'wy',
        [MusicSource.QQ]: 'tx',
        [MusicSource.Kugou]: 'kg',
        [MusicSource.Kuwo]: 'kw',
    };

    /**
     * TuneHub 音源来源代码映射
     */
    private readonly tuneHubSourceCodeMap: Record<string, string> = {
        [MusicSource.Netease]: 'netease',
        [MusicSource.QQ]: 'qq',
        [MusicSource.Kuwo]: 'kuwo',
    };

    /**
     * 各音源类型默认支持的搜索平台
     */
    public readonly defaultSupportedPlatforms: Record<AudioSourceType, string[]> = {
        [AudioSourceType.OmniParse]: ['netease', 'qq', 'kugou', 'kuwo', 'apple', 'spotify'],
        [AudioSourceType.TuneHub]: ['netease', 'qq', 'kuwo'],
        [AudioSourceType.LxMusic]: [], // 动态从脚本获取
    };

    public getLxQuality(quality: AudioQuality | string): string {
        switch (quality) {
            case AudioQuality.Standard: return '128k';
            case AudioQuality.ExHigh: return '320k';
            case AudioQuality.Lossless: return 'flac';
            case AudioQuality.HiRes: return 'flac24bit';
            default:
                // 如果已经是 lx 格式的字符串（如 '128k'），直接返回
                return quality;
        }
    }

    public getTuneHubQuality(quality: AudioQuality): string {
        switch (quality) {
            case AudioQuality.Standard: return '128k';
            case AudioQuality.ExHigh: return '320k';
            case AudioQuality.Lossless: return 'flac';
            case AudioQuality.HiRes: return 'flac24bit';
            default: return '320k';
        }
    }

    private cleanUrl(url: string): string {
        if (!url) return '';
        let result = url.trim();
        result = result.replace(/^["']|["']$/g, '');
        result = result.replace(/\/$/, '');
        return result;
    }

    /**
     * 构建播放 URL
     */
    public buildPlaybackUrl(config: AudioSourceConfig, source: MusicSource, songId: string | number, quality: AudioQuality): string {
        const baseUrl = this.cleanUrl(config.url);
        if (!baseUrl) return '';

        switch (config.type) {
            case AudioSourceType.OmniParse:
                return this.buildOmniParseUrl(baseUrl, source, songId, quality);
            case AudioSourceType.LxMusic:
                return this.buildLxMusicUrl(baseUrl, config, source, songId, quality);
            case AudioSourceType.TuneHub:
                return this.buildTuneHubMusicUrl(baseUrl, config, source, songId, quality);
            default:
                return '';
        }
    }

    private buildOmniParseUrl(baseUrl: string, source: MusicSource, songId: string | number, quality: AudioQuality): string {
        // 映射源到 API 路径
        const sourcePathMap: Record<string, string> = {
            [MusicSource.Netease]: 'song',
            [MusicSource.QQ]: 'qq/song',
            [MusicSource.Kugou]: 'kugou/song',
            [MusicSource.Kuwo]: 'kuwo/song',
            [MusicSource.Apple]: 'apple/song',
            [MusicSource.Spotify]: 'spotify/stream',
            [MusicSource.Qishui]: 'qishui',
        };

        const path = sourcePathMap[source];
        if (!path) return '';

        const base = `${baseUrl}/${path}`;

        switch (source) {
            case MusicSource.Netease:
                return `${base}?id=${songId}&quality=${quality}&type=json`;
            case MusicSource.QQ:
                // 后端期望 ids 或 url 参数
                return `${base}?ids=${songId}&quality=${quality}`;
            case MusicSource.Kugou: {
                // 搜索返回的 id 格式为 "hash:albumId" 或 "emixsongid"
                const idStr = String(songId);
                if (idStr.includes(':')) {
                    const [hash, albumId] = idStr.split(':');
                    return `${base}?hash=${hash}&album_audio_id=${albumId || '0'}&quality=${quality}`;
                }
                return `${base}?emixsongid=${songId}&quality=${quality}`;
            }
            case MusicSource.Kuwo:
                // 后端期望 mid 参数
                return `${base}?mid=${songId}&quality=${quality}`;
            case MusicSource.Qishui:
                // 汽水音乐通过 url 参数传入完整链接
                return `${base}?url=https://music.douyin.com/track/${songId}`;
            default:
                return `${base}?id=${songId}&quality=${quality}`;
        }
    }

    private buildLxMusicUrl(baseUrl: string, config: AudioSourceConfig, source: MusicSource, songId: string | number, quality: AudioQuality): string {
        const sourceCode = this.lxSourceCodeMap[source];
        if (!sourceCode) return '';

        const lxQuality = this.getLxQuality(quality);

        if (config.urlPathTemplate) {
            const path = config.urlPathTemplate
                .replace('{source}', sourceCode)
                .replace('{songId}', songId.toString())
                .replace('{quality}', lxQuality);
            return `${baseUrl}${path}`;
        }

        return `${baseUrl}/url/${sourceCode}/${songId}/${lxQuality}`;
    }

    private buildTuneHubMusicUrl(baseUrl: string, config: AudioSourceConfig, source: MusicSource, songId: string | number, quality: AudioQuality): string {
        const platform = this.tuneHubSourceCodeMap[source];
        if (!platform) return '';
        const br = this.getTuneHubQuality(quality);
        return `${baseUrl}/api/?type=url&source=${platform}&id=${songId}&br=${br}`;
    }
}

export const audioSourceService = AudioSourceService.getInstance();
