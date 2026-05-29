import { readFile, writeFile, exists, mkdir, remove, readDir, stat } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { useCacheStore } from '../store/useCacheStore';
import { Track } from '../models/track';

// 简易且快速的加密掩码，仅用于防止普通播放器识别
const XOR_MASK = 0x7C;

class CacheService {
    private static instance: CacheService;
    // 内存中的 Blob URL 映射，避免重复创建 URL
    private blobUrlCache: Map<string, string> = new Map();

    private constructor() {}

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    /**
     * 获取缓存主目录
     */
    public async getCacheDir(): Promise<string> {
        const customDir = useCacheStore.getState().cacheDirectory;
        if (customDir) {
            return customDir;
        }
        const localDataDir = await appLocalDataDir();
        const defaultCacheDir = await join(localDataDir, 'cyrene_music_cache');
        if (!(await exists(defaultCacheDir))) {
            await mkdir(defaultCacheDir, { recursive: true });
        }
        return defaultCacheDir;
    }

    /**
     * 生成特定的缓存文件路径
     */
    public async buildCacheFilePath(trackId: string | number, source: string, quality: string): Promise<string> {
        const cacheDir = await this.getCacheDir();
        // 清理非法字符
        const safeId = String(trackId).replace(/[^a-zA-Z0-9_\-]/g, '_');
        return await join(cacheDir, `${source}_${safeId}_${quality}.cyrene`);
    }

    /**
     * 检查是否已缓存
     */
    public async isCached(trackId: string | number, source: string, quality: string): Promise<boolean> {
        if (typeof window === 'undefined') return false; // 防止 SSR 报错
        try {
            const filePath = await this.buildCacheFilePath(trackId, source, quality);
            return await exists(filePath);
        } catch (e) {
            console.error('[CacheService] isCached error:', e);
            return false;
        }
    }

    /**
     * 对 Uint8Array 进行就地 XOR 加解密 (加密和解密是同一过程)
     */
    private applyCipher(buffer: Uint8Array): void {
        const length = buffer.length;
        for (let i = 0; i < length; i++) {
            buffer[i] ^= XOR_MASK;
        }
    }

    /**
     * 获取已缓存音频的临时播放地址 (Blob URL)
     */
    public async getCachedAudioBlobUrl(trackId: string | number, source: string, quality: string): Promise<string> {
        const cacheKey = `${source}_${trackId}_${quality}`;
        if (this.blobUrlCache.has(cacheKey)) {
            return this.blobUrlCache.get(cacheKey)!;
        }

        const filePath = await this.buildCacheFilePath(trackId, source, quality);
        const fileData = await readFile(filePath);
        
        // 解密文件内容
        this.applyCipher(fileData);

        // 生成 Blob URL，默认使用 mp3/flac 通用类型
        const blob = new Blob([fileData], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        this.blobUrlCache.set(cacheKey, blobUrl);

        return blobUrl;
    }

    /**
     * 后台静默下载并加密缓存
     */
    public async downloadAndCache(track: Track, url: string, quality: string): Promise<void> {
        if (!useCacheStore.getState().isCacheEnabled) return;
        
        try {
            const isAlreadyCached = await this.isCached(track.id, track.source, quality);
            if (isAlreadyCached) return;

            console.log(`[CacheService] ⬇️ 开始后台缓存: ${track.name}`);
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // 对数据进行快速加密
            this.applyCipher(uint8Array);
            
            const filePath = await this.buildCacheFilePath(track.id, track.source, quality);
            await writeFile(filePath, uint8Array);
            
            console.log(`[CacheService] ✅ 缓存成功并已加密: ${track.name} -> ${filePath}`);
        } catch (e) {
            console.warn(`[CacheService] ❌ 缓存失败: ${track.name}`, e);
        }
    }

    /**
     * 计算当前缓存占用空间 (字节)
     */
    public async calculateCacheSize(): Promise<number> {
        try {
            const cacheDir = await this.getCacheDir();
            if (!(await exists(cacheDir))) return 0;
            
            const entries = await readDir(cacheDir);
            let totalSize = 0;
            
            for (const entry of entries) {
                if (entry.isFile && entry.name && entry.name.endsWith('.cyrene')) {
                    const filePath = await join(cacheDir, entry.name);
                    const fileStat = await stat(filePath);
                    totalSize += fileStat.size || 0;
                }
            }
            return totalSize;
        } catch (e) {
            console.error('[CacheService] Calculate size error:', e);
            return 0;
        }
    }

    /**
     * 清除所有缓存
     */
    public async clearCache(): Promise<void> {
        try {
            const cacheDir = await this.getCacheDir();
            if (!(await exists(cacheDir))) return;
            
            const entries = await readDir(cacheDir);
            for (const entry of entries) {
                if (entry.isFile && entry.name && entry.name.endsWith('.cyrene')) {
                    const filePath = await join(cacheDir, entry.name);
                    await remove(filePath);
                }
            }
            
            // 清理内存中的 blob URL
            this.blobUrlCache.forEach(url => URL.revokeObjectURL(url));
            this.blobUrlCache.clear();
            
            console.log('[CacheService] 🧹 缓存清理完毕');
        } catch (e) {
            console.error('[CacheService] Clear cache error:', e);
            throw e;
        }
    }
}

export const cacheService = CacheService.getInstance();
