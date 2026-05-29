import { Track } from "../models/track";

/**
 * 播放记录数据库条目接口
 */
export interface HistoryEntry {
    id: string | number;         // 歌曲ID
    source: string;              // 播放平台 (netease, qq, kugou, etc.)
    name: string;                // 歌曲名称
    artists: string;             // 歌手
    album: string;               // 专辑
    picUrl: string;              // 封面
    playCount: number;           // 播放次数
    listeningTime: number;       // 累计播放时长 (秒)
    lastPlayedAt: number;        // 最后播放时间戳
    firstPlayedAt?: number;      // 第一次播放时间戳
}

/**
 * 总体统计数据接口
 */
export interface OverallStats {
    totalListeningTime: number;  // 总听歌时长
    totalPlayCount: number;      // 总播放次数
}

class HistoryService {
    private static instance: HistoryService;
    private dbName = "CyreneMusicDB";
    private storeName = "playHistory";
    private dbVersion = 1;
    private db: IDBDatabase | null = null;

    private constructor() { }

    public static getInstance(): HistoryService {
        if (!HistoryService.instance) {
            HistoryService.instance = new HistoryService();
        }
        return HistoryService.instance;
    }

    /**
     * 初始化/打开数据库
     */
    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // 以 id 和 source 的组合逻辑标识歌曲
                    const store = db.createObjectStore(this.storeName, { keyPath: ["id", "source"] });
                    store.createIndex("lastPlayedAt", "lastPlayedAt", { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    /**
     * 记录/更新播放
     */
    public async recordPlay(track: Track) {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);

        // 使用字符串形式的 ID 避免混淆
        const trackId = String(track.id).trim();
        const source = track.source;

        return new Promise<void>((resolve, reject) => {
            const getRequest = store.get([trackId, source]);

            getRequest.onsuccess = () => {
                const data = getRequest.result as HistoryEntry | undefined;
                const now = Date.now();

                if (data) {
                    data.playCount += 1;
                    data.lastPlayedAt = now;
                    if (!data.firstPlayedAt) {
                        data.firstPlayedAt = now;
                    }
                    // 更新可能变化的元数据
                    data.name = track.name;
                    data.artists = track.artists;
                    data.album = track.album || "";
                    data.picUrl = track.picUrl || "";
                    store.put(data);
                } else {
                    const newEntry: HistoryEntry = {
                        id: trackId,
                        source: source,
                        name: track.name,
                        artists: track.artists,
                        album: track.album || "",
                        picUrl: track.picUrl || "",
                        playCount: 1,
                        listeningTime: 0,
                        lastPlayedAt: now,
                        firstPlayedAt: now
                    };
                    store.add(newEntry);
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 记录听歌时长
     */
    public async recordTime(trackId: string | number, source: string, seconds: number) {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const sid = String(trackId).trim();

        return new Promise<void>((resolve, reject) => {
            const getRequest = store.get([sid, source]);
            getRequest.onsuccess = () => {
                const data = getRequest.result as HistoryEntry | undefined;
                if (data) {
                    data.listeningTime += seconds;
                    store.put(data);
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 获取单个歌曲的历史统计
     */
    public async getTrackStats(trackId: string | number, source: string): Promise<HistoryEntry | null> {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const sid = String(trackId).trim();

        return new Promise((resolve) => {
            const request = store.get([sid, source]);
            request.onsuccess = () => {
                resolve(request.result as HistoryEntry || null);
            };
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    /**
     * 获取所有历史记录（按时间倒序）
     */
    public async getHistory(limit = 100): Promise<HistoryEntry[]> {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const index = store.index("lastPlayedAt");

        return new Promise((resolve, reject) => {
            const results: HistoryEntry[] = [];
            index.openCursor(null, "prev").onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
        });
    }

    /**
     * 获取所有历史记录（无数量限制，用于同步）
     */
    public async getAll(): Promise<HistoryEntry[]> {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve) => {
            const results: HistoryEntry[] = [];
            store.openCursor().onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
        });
    }

    /**
     * 获取统计数据
     */
    public async getStats(): Promise<OverallStats> {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve) => {
            let totalListeningTime = 0;
            let totalPlayCount = 0;

            store.openCursor().onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    totalListeningTime += cursor.value.listeningTime || 0;
                    totalPlayCount += cursor.value.playCount || 0;
                    cursor.continue();
                } else {
                    resolve({ totalListeningTime, totalPlayCount });
                }
            };
        });
    }
}

export const historyService = HistoryService.getInstance();
