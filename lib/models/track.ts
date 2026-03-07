
import { MusicSource } from '../services/audioSourceService';

/**
 * 歌曲轨道详情
 */
export interface Track {
    /** 平台内部 ID (Netease 为 number, QQ 为 string mdia) */
    id: string | number;
    /** 歌曲名称 */
    name: string;
    /** 歌手名称 */
    artists: string;
    /** 专辑名称 */
    album: string;
    /** 封面图片 URL */
    picUrl: string;
    /** 音乐来源 */
    source: MusicSource;
    /** 歌词数据 (JSON 字符串) */
    lyric?: string;
    /** 逐字歌词数据 (JSON 字符串) */
    yrc?: string;
    /** 歌词翻译 (LRC 格式) */
    tlyric?: string;
    /** 逐字歌词翻译 (LRC 格式) */
    ytlrc?: string;
    /** 副歌时间区间 */
    chorus?: { startTime: number; endTime: number }[];
    /** 歌曲时长 (秒) */
    duration?: number;
}

/**
 * 合并后的歌曲轨道（支持多源播放）
 */
export class MergedTrack {
    /** 标准化后的唯一键: name|artists */
    readonly key: string;
    /** 歌曲名称 */
    readonly name: string;
    /** 歌手名称 */
    readonly artists: string;
    /** 封面图片 URL */
    readonly picUrl: string;
    /** 不同来源的实例列表 */
    readonly tracks: Track[];
    /** 主要来源（通常是第一个搜索结果） */
    readonly mainSource: MusicSource;

    constructor(tracks: Track[]) {
        if (tracks.length === 0) throw new Error("Tracks cannot be empty");

        const first = tracks[0];
        this.name = first.name;
        this.artists = first.artists;
        this.picUrl = first.picUrl;
        this.tracks = tracks;
        this.mainSource = first.source;
        this.key = `${this.normalize(this.name)}|${this.normalize(this.artists)}`;
    }

    private normalize(str: string): string {
        return str
            .trim()
            .toLowerCase()
            .replace(/\s/g, '')
            .replace(/[、\/&，]/g, ',');
    }

    static fromTracks(tracks: Track[]): MergedTrack {
        return new MergedTrack(tracks);
    }
}
