
import { Track } from './track';

/**
 * 跨平台搜索结果状态
 */

export interface NeteaseArtistBrief {
    id: number;
    name: string;
    picUrl: string;
    alias?: string[];
}

export interface SearchResult {
    neteaseResults: Track[];
    qqResults: Track[];
    kugouResults: Track[];
    kuwoResults: Track[];
    appleResults: Track[];
    spotifyResults: Track[];
    qishuiResults: Track[];
    artistResults: NeteaseArtistBrief[];

    neteaseLoading: boolean;
    qqLoading: boolean;
    kugouLoading: boolean;
    kuwoLoading: boolean;
    appleLoading: boolean;
    spotifyLoading: boolean;
    qishuiLoading: boolean;
    artistLoading: boolean;

    neteaseError?: string;
    qqError?: string;
    kugouError?: string;
    kuwoError?: string;
    appleError?: string;
    spotifyError?: string;
    qishuiError?: string;
    artistError?: string;
}

export const initialSearchResult: SearchResult = {
    neteaseResults: [],
    qqResults: [],
    kugouResults: [],
    kuwoResults: [],
    appleResults: [],
    spotifyResults: [],
    qishuiResults: [],
    artistResults: [],

    neteaseLoading: false,
    qqLoading: false,
    kugouLoading: false,
    kuwoLoading: false,
    appleLoading: false,
    spotifyLoading: false,
    qishuiLoading: false,
    artistLoading: false,
};
