import { urlService } from './urlService';
import { Track } from '../models/track';

export interface ArtistDetailInfo {
    artist: {
        id: number;
        name: string;
        picUrl?: string;
        img1v1Url?: string;
        briefDesc?: string;
        alias?: string[];
        musicSize?: number;
        albumSize?: number;
        mvSize?: number;
    };
    songs: Track[];
    albums: {
        id: number;
        name: string;
        picUrl?: string;
        company?: string;
        publishTime?: number;
    }[];
}

class ArtistService {
    private static instance: ArtistService;

    private constructor() { }

    public static getInstance(): ArtistService {
        if (!ArtistService.instance) {
            ArtistService.instance = new ArtistService();
        }
        return ArtistService.instance;
    }

    /**
     * 根据歌手名称解析歌手ID（用于没有返回ID时的聚合搜索）
     */
    public async resolveArtistIdByName(artistName: string): Promise<number | null> {
        if (!artistName) return null;
        try {
            const resp = await fetch(`${urlService.baseUrl}/artist/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ keywords: artistName, limit: '1' })
            });

            if (!resp.ok) {
                console.error(`[ArtistService] resolveArtistIdByName Failed HTTP ${resp.status}`);
                return null;
            }

            const data = await resp.json();
            if (data.status === 200 && data.result && data.result.length > 0) {
                return data.result[0].id; // 返回第一个匹配的歌手ID
            }
            return null;
        } catch (error) {
            console.error('[ArtistService] resolveArtistIdByName Error:', error);
            return null;
        }
    }

    /**
     * 获取歌手详情（聚合信息：包含部分热门歌曲和专辑）
     */
    public async fetchArtistDetail(id: number | string): Promise<ArtistDetailInfo | null> {
        try {
            const resp = await fetch(`${urlService.baseUrl}/artist/detail?id=${id}`, {
                method: 'GET',
            });

            if (!resp.ok) {
                console.error(`[ArtistService] fetchArtistDetail Failed HTTP ${resp.status}`);
                return null;
            }

            const data = await resp.json();
            if (data.status === 200 && data.data) {
                const result = data.data;

                // 提取热门单曲
                const songs: Track[] = (result.songs || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    artists: item.artists || '',
                    album: item.album || '',
                    picUrl: item.picUrl || '',
                    source: 'netease', // 这里后端返回的聚合数据默认归为此源
                }));

                // 提取专辑信息
                const albums = (result.albums || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    picUrl: item.picUrl || item.coverImgUrl || '',
                    company: item.company || '',
                    publishTime: item.publishTime || item.publish_time || 0,
                }));

                // 返回包装的结果
                return {
                    artist: result.artist || {},
                    songs,
                    albums,
                };
            }

            return null;
        } catch (error) {
            console.error('[ArtistService] fetchArtistDetail Error:', error);
            return null;
        }
    }
}

export const artistService = ArtistService.getInstance();
