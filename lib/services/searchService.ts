
import { initialSearchResult, SearchResult } from '../models/search';
import { MergedTrack, Track } from '../models/track';
import { urlService } from './urlService';
import { AudioSourceType } from '../models/audioSourceConfig';
import { useAudioSourceStore } from '../store/useAudioSourceStore';
import { useSearchPreferencesStore } from '../store/useSearchPreferencesStore';
import { MusicSource } from './audioSourceService';

class SearchService {
    private static instance: SearchService;
    private _searchResult: SearchResult = { ...initialSearchResult };
    private _currentKeyword: string = '';
    private _searchHistory: string[] = [];
    private readonly HISTORY_KEY = 'search_history';
    private readonly MAX_HISTORY_COUNT = 20;

    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadSearchHistory();
        }
    }

    public static getInstance(): SearchService {
        if (!SearchService.instance) {
            SearchService.instance = new SearchService();
        }
        return SearchService.instance;
    }

    public get searchResult(): SearchResult { return this._searchResult; }
    public get currentKeyword(): string { return this._currentKeyword; }
    public get searchHistory(): string[] { return this._searchHistory; }

    /**
     * 加载搜索历史
     */
    private loadSearchHistory() {
        try {
            const stored = localStorage.getItem(this.HISTORY_KEY);
            if (stored) {
                this._searchHistory = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[SearchService] Failed to load search history:', e);
        }
    }

    /**
     * 保存搜索历史
     */
    private saveSearchHistory() {
        try {
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this._searchHistory));
            this.notifyListeners();
        } catch (e) {
            console.error('[SearchService] Failed to save search history:', e);
        }
    }

    public async addToSearchHistory(keyword: string) {
        const trimmed = keyword.trim();
        if (!trimmed) return;

        this._searchHistory = [trimmed, ...this._searchHistory.filter(h => h !== trimmed)].slice(0, this.MAX_HISTORY_COUNT);
        this.saveSearchHistory();
    }

    public async removeSearchHistory(keyword: string) {
        this._searchHistory = this._searchHistory.filter(h => h !== keyword);
        this.saveSearchHistory();
    }

    public async clearSearchHistory() {
        this._searchHistory = [];
        this.saveSearchHistory();
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    /**
     * 执行搜索
     */
    public async search(keyword: string) {
        const trimmed = keyword.trim();
        if (!trimmed) return;

        this._currentKeyword = trimmed;
        this.addToSearchHistory(trimmed);

        // 获取当前支持的平台
        const sourceStore = useAudioSourceStore.getState();
        const activeSource = sourceStore.sources.length > 0 ? sourceStore.sources[0] : null;

        let supportedPlatforms: string[] = [];
        if (activeSource) {
            if (activeSource.type === AudioSourceType.OmniParse) {
                supportedPlatforms = ['netease', 'qq', 'kugou', 'kuwo', 'apple', 'spotify', 'qishui'];
            } else if (activeSource.type === AudioSourceType.TuneHub) {
                supportedPlatforms = ['netease', 'qq', 'kuwo'];
            } else if (activeSource.type === AudioSourceType.LxMusic) {
                // TODO: 从脚本内容中解析支持的平台，暂时默认四大平台
                supportedPlatforms = ['netease', 'qq', 'kugou', 'kuwo'];
            }
        }

        // 应用用户的搜索首选项：若用户指定了平台，则仅搜索用户选中且当前音源支持的平台
        const preferredPlatforms = useSearchPreferencesStore.getState().enabledPlatforms;
        if (preferredPlatforms.length > 0) {
            supportedPlatforms = supportedPlatforms.filter(p => preferredPlatforms.includes(p));
        }

        // 重置搜索结果并设置加载状态
        this._searchResult = {
            ...initialSearchResult,
            neteaseLoading: supportedPlatforms.includes('netease'),
            qqLoading: supportedPlatforms.includes('qq'),
            kugouLoading: supportedPlatforms.includes('kugou'),
            kuwoLoading: supportedPlatforms.includes('kuwo'),
            appleLoading: supportedPlatforms.includes('apple'),
            spotifyLoading: supportedPlatforms.includes('spotify'),
            qishuiLoading: supportedPlatforms.includes('qishui'),
            artistLoading: true, // 总是搜索歌手
        };
        this.notifyListeners();

        // 发起并行搜索
        const promises: Promise<void>[] = [];
        if (supportedPlatforms.includes('netease')) promises.push(this.searchNetease(trimmed));
        if (supportedPlatforms.includes('qq')) promises.push(this.searchQQ(trimmed));
        if (supportedPlatforms.includes('kugou')) promises.push(this.searchKugou(trimmed));
        if (supportedPlatforms.includes('kuwo')) promises.push(this.searchKuwo(trimmed));
        if (supportedPlatforms.includes('apple')) promises.push(this.searchApple(trimmed));
        if (supportedPlatforms.includes('spotify')) promises.push(this.searchSpotify(trimmed));
        if (supportedPlatforms.includes('qishui')) promises.push(this.searchQishui(trimmed));
        promises.push(this.searchArtists(trimmed)); // 并行搜索歌手

        await Promise.allSettled(promises);
    }

    private async searchNetease(keyword: string) {
        try {
            const resp = await fetch(urlService.searchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ keywords: keyword, limit: '20' })
            });
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.result || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    artists: item.artists || '',
                    album: item.album || '',
                    picUrl: item.picUrl || '',
                    source: MusicSource.Netease
                }));
                this._searchResult = { ...this._searchResult, neteaseResults: results, neteaseLoading: false };
            } else {
                throw new Error(data.message || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, neteaseLoading: false, neteaseError: e.message };
        }
        this.notifyListeners();
    }

    private async searchQQ(keyword: string) {
        try {
            const resp = await fetch(`${urlService.qqSearchUrl}?keywords=${encodeURIComponent(keyword)}&limit=20`);
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.result || []).map((item: any) => ({
                    id: item.mid || '',
                    name: item.name || '',
                    artists: item.singer || '',
                    album: item.album || '',
                    picUrl: item.pic || '',
                    source: MusicSource.QQ
                }));
                this._searchResult = { ...this._searchResult, qqResults: results, qqLoading: false };
            } else {
                throw new Error(data.message || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, qqLoading: false, qqError: e.message };
        }
        this.notifyListeners();
    }

    private async searchKugou(keyword: string) {
        try {
            // 酷狗搜索通常需要特殊处理，参考 Flutter 实现
            const resp = await fetch(`${urlService.kugouSearchUrl}?keywords=${encodeURIComponent(keyword)}&limit=30`);
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.result || []).map((item: any) => {
                    const hash = item.hash || '';
                    const albumId = item.album_id || '';
                    return {
                        id: hash ? `${hash}:${albumId}` : (item.emixsongid || ''),
                        name: item.name || '',
                        artists: item.singer || '',
                        album: item.album || '',
                        picUrl: item.pic || '',
                        source: MusicSource.Kugou
                    };
                });
                this._searchResult = { ...this._searchResult, kugouResults: results, kugouLoading: false };
            } else {
                throw new Error(data.message || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, kugouLoading: false, kugouError: e.message };
        }
        this.notifyListeners();
    }

    private async searchKuwo(keyword: string) {
        try {
            const resp = await fetch(`${urlService.kuwoSearchUrl}?keywords=${encodeURIComponent(keyword)}`);
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.data?.songs || []).map((item: any) => ({
                    id: item.rid || 0,
                    name: item.name || '',
                    artists: item.artist || '',
                    album: item.album || '',
                    picUrl: item.pic || '',
                    source: MusicSource.Kuwo
                }));
                this._searchResult = { ...this._searchResult, kuwoResults: results, kuwoLoading: false };
            } else {
                throw new Error(data.message || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, kuwoLoading: false, kuwoError: e.message };
        }
        this.notifyListeners();
    }

    private async searchApple(keyword: string) {
        try {
            const resp = await fetch(`${urlService.appleSearchUrl}?keywords=${encodeURIComponent(keyword)}&limit=20`);
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.result || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    artists: item.artists || '',
                    album: item.album || '',
                    picUrl: item.picUrl || '',
                    source: MusicSource.Apple
                }));
                this._searchResult = { ...this._searchResult, appleResults: results, appleLoading: false };
            } else {
                throw new Error(data.message || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, appleLoading: false, appleError: e.message };
        }
        this.notifyListeners();
    }

    private async searchSpotify(keyword: string) {
        try {
            const resp = await fetch(`${urlService.spotifySearchUrl}?keywords=${encodeURIComponent(keyword)}`);
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.result?.tracks || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    artists: (item.artists || []).map((a: any) => a.name).join(', '),
                    album: item.album?.name || '',
                    picUrl: item.album?.coverArt || '',
                    source: MusicSource.Spotify
                }));
                this._searchResult = { ...this._searchResult, spotifyResults: results, spotifyLoading: false };
            } else {
                throw new Error(data.message || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, spotifyLoading: false, spotifyError: e.message };
        }
        this.notifyListeners();
    }

    private async searchQishui(keyword: string, cursor: number = 0) {
        try {
            const resp = await fetch(`${urlService.qishuiSearchUrl}?keyword=${encodeURIComponent(keyword)}&cursor=${cursor}`);
            const data = await resp.json();
            if (data.status === 200) {
                const results: Track[] = (data.tracks || []).map((item: any) => ({
                    id: item.id || '',
                    name: item.title || '',
                    artists: item.artist || '',
                    album: item.album || '',
                    picUrl: item.pic || '',
                    source: MusicSource.Qishui,
                    duration: item.duration ? Math.round(item.duration / 1000) : undefined,
                }));
                if (cursor === 0) {
                    this._searchResult = { ...this._searchResult, qishuiResults: results, qishuiLoading: false };
                } else {
                    this._searchResult = {
                        ...this._searchResult,
                        qishuiResults: [...this._searchResult.qishuiResults, ...results],
                        qishuiLoading: false,
                    };
                }
            } else {
                throw new Error(data.msg || 'Search failed');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, qishuiLoading: false, qishuiError: e.message };
        }
        this.notifyListeners();
    }

    private async searchArtists(keyword: string) {
        try {
            const resp = await fetch(`${urlService.baseUrl}/artist/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ keywords: keyword, limit: '20' })
            });

            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }

            const data = await resp.json();
            if (data.status === 200) {
                const results = (data.result || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    picUrl: item.picUrl || '',
                    alias: item.alias || []
                }));
                this._searchResult = { ...this._searchResult, artistResults: results, artistLoading: false };
            } else {
                throw new Error(data.message || 'Server error');
            }
        } catch (e: any) {
            this._searchResult = { ...this._searchResult, artistLoading: false, artistError: e.message };
        }
        this.notifyListeners();
    }

    /**
     * 获取合并后的结果
     */
    public getMergedResults(): MergedTrack[] {
        const allTracks: Track[] = [
            ...this._searchResult.neteaseResults,
            ...this._searchResult.qqResults,
            ...this._searchResult.kugouResults,
            ...this._searchResult.kuwoResults,
            ...this._searchResult.spotifyResults,
            ...this._searchResult.appleResults,
            ...this._searchResult.qishuiResults,
        ];

        if (allTracks.length === 0) return [];

        const mergedMap = new Map<string, Track[]>();
        for (const track of allTracks) {
            const key = `${this.normalize(track.name)}|${this.normalize(track.artists)}`;
            if (!mergedMap.has(key)) {
                mergedMap.set(key, []);
            }
            mergedMap.get(key)!.push(track);
        }

        return Array.from(mergedMap.values()).map(tracks => new MergedTrack(tracks));
    }

    private normalize(str: string): string {
        return str.trim().toLowerCase().replace(/\s/g, '').replace(/[、\/&，]/g, ',');
    }
}

export const searchService = SearchService.getInstance();
