import { invoke } from '@tauri-apps/api/core';
import { MusicSource } from './audioSourceService';
import { Track } from '../models/track';

export interface LocalTrackMetadata {
    filePath: string;
    name: string;
    artists: string;
    album: string;
    duration: number;
    coverDataUrl: string | null;
    lyric: string | null;
}

export interface LocalTrackEntry {
    filePath: string;
    name: string;
    artists: string;
    album: string;
    duration: number;
    coverDataUrl: string | null;
    lyric: string | null;
    hasLrcFile: boolean;
    addedAt: number;
    folderPath: string | null;
}

class LocalMusicService {
    private static instance: LocalMusicService;
    private dbName = "CyreneLocalMusicDB";
    private storeName = "localTracks";
    private folderStoreName = "scannedFolders";
    private dbVersion = 1;
    private db: IDBDatabase | null = null;

    private constructor() {}

    public static getInstance(): LocalMusicService {
        if (!LocalMusicService.instance) {
            LocalMusicService.instance = new LocalMusicService();
        }
        return LocalMusicService.instance;
    }

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: "filePath" });
                    store.createIndex("name", "name", { unique: false });
                    store.createIndex("artists", "artists", { unique: false });
                    store.createIndex("album", "album", { unique: false });
                    store.createIndex("folderPath", "folderPath", { unique: false });
                    store.createIndex("addedAt", "addedAt", { unique: false });
                }
                if (!db.objectStoreNames.contains(this.folderStoreName)) {
                    db.createObjectStore(this.folderStoreName, { keyPath: "path" });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    public async scanFolder(folderPath: string): Promise<number> {
        const results: LocalTrackMetadata[] = await invoke('scan_music_folder', { path: folderPath });
        const db = await this.getDB();

        let count = 0;
        const tx = db.transaction([this.storeName, this.folderStoreName], "readwrite");
        const store = tx.objectStore(this.storeName);
        const folderStore = tx.objectStore(this.folderStoreName);

        // Record the scanned folder
        folderStore.put({ path: folderPath, scannedAt: Date.now() });

        for (const meta of results) {
            const entry: LocalTrackEntry = {
                filePath: meta.filePath,
                name: meta.name,
                artists: meta.artists,
                album: meta.album,
                duration: meta.duration,
                coverDataUrl: meta.coverDataUrl,
                lyric: meta.lyric,
                hasLrcFile: false,
                addedAt: Date.now(),
                folderPath,
            };
            store.put(entry);
            count++;
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(count);
            tx.onerror = () => reject(tx.error);
        });
    }

    public async importFiles(filePaths: string[]): Promise<number> {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        let count = 0;

        for (const filePath of filePaths) {
            try {
                const meta: LocalTrackMetadata = await invoke('get_audio_metadata', { path: filePath });
                const entry: LocalTrackEntry = {
                    filePath: meta.filePath,
                    name: meta.name,
                    artists: meta.artists,
                    album: meta.album,
                    duration: meta.duration,
                    coverDataUrl: meta.coverDataUrl,
                    lyric: meta.lyric,
                    hasLrcFile: false,
                    addedAt: Date.now(),
                    folderPath: null,
                };
                store.put(entry);
                count++;
            } catch (e) {
                console.warn(`[LocalMusicService] Failed to import: ${filePath}`, e);
            }
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(count);
            tx.onerror = () => reject(tx.error);
        });
    }

    public async getAll(): Promise<LocalTrackEntry[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const request = store.index("addedAt").openCursor(null, "prev");
            const results: LocalTrackEntry[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    public async search(keyword: string): Promise<LocalTrackEntry[]> {
        const all = await this.getAll();
        const kw = keyword.toLowerCase();
        return all.filter(t =>
            t.name.toLowerCase().includes(kw) ||
            t.artists.toLowerCase().includes(kw) ||
            t.album.toLowerCase().includes(kw)
        );
    }

    public async remove(filePath: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            store.delete(filePath);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    public async removeByFolder(folderPath: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.storeName, this.folderStoreName], "readwrite");
            const store = tx.objectStore(this.storeName);
            const folderStore = tx.objectStore(this.folderStoreName);
            const index = store.index("folderPath");
            const request = index.openCursor(IDBKeyRange.only(folderPath));

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            folderStore.delete(folderPath);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    public async getFolders(): Promise<{ path: string; scannedAt: number }[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.folderStoreName, "readonly");
            const store = tx.objectStore(this.folderStoreName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    public async rescanFolder(folderPath: string): Promise<number> {
        await this.removeByFolder(folderPath);
        return this.scanFolder(folderPath);
    }

    public toTrack(entry: LocalTrackEntry): Track {
        return {
            id: entry.filePath,
            name: entry.name,
            artists: entry.artists,
            album: entry.album,
            picUrl: entry.coverDataUrl || '',
            source: MusicSource.Local,
            lyric: entry.lyric || undefined,
            duration: entry.duration,
            filePath: entry.filePath,
        };
    }

    public async loadLrcForTrack(track: Track): Promise<string | null> {
        if (!track.filePath) return null;
        try {
            return await invoke('read_lrc_file', { audioPath: track.filePath });
        } catch {
            return null;
        }
    }
}

export const localMusicService = LocalMusicService.getInstance();