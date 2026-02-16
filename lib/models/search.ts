
import { Track } from './track';

/**
 * 跨平台搜索结果状态
 */
export interface SearchResult {
    neteaseResults: Track[];
    qqResults: Track[];
    kugouResults: Track[];
    kuwoResults: Track[];
    appleResults: Track[];
    spotifyResults: Track[];

    neteaseLoading: boolean;
    qqLoading: boolean;
    kugouLoading: boolean;
    kuwoLoading: boolean;
    appleLoading: boolean;
    spotifyLoading: boolean;

    neteaseError?: string;
    qqError?: string;
    kugouError?: string;
    kuwoError?: string;
    appleError?: string;
    spotifyError?: string;
}

export const initialSearchResult: SearchResult = {
    neteaseResults: [],
    qqResults: [],
    kugouResults: [],
    kuwoResults: [],
    appleResults: [],
    spotifyResults: [],

    neteaseLoading: false,
    qqLoading: false,
    kugouLoading: false,
    kuwoLoading: false,
    appleLoading: false,
    spotifyLoading: false,
};
