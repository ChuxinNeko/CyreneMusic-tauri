import { useAuthStore } from "../store/useAuthStore";
import { urlService } from "./urlService";
import { Track } from "../models/track";

class ListeningStatsService {
    private static instance: ListeningStatsService;
    private pendingSeconds: number = 0;
    private syncInterval: any = null;

    private constructor() {
        if (typeof window !== "undefined") {
            this.initialize();
        }
    }

    public static getInstance(): ListeningStatsService {
        if (!ListeningStatsService.instance) {
            ListeningStatsService.instance = new ListeningStatsService();
        }
        return ListeningStatsService.instance;
    }

    private initialize() {
        // 每 10 秒尝试同步一次听歌时长
        this.syncInterval = setInterval(() => {
            this.syncListeningTime();
        }, 10000);
        console.log("📊 [ListeningStatsService] 服务已初始化，同步间隔: 10s");
    }

    /**
     * 累积听歌时长
     * @param seconds 秒数
     */
    public accumulateListeningTime(seconds: number) {
        this.pendingSeconds += seconds;
    }

    /**
     * 同步听歌时长到服务器
     */
    private async syncListeningTime() {
        if (this.pendingSeconds <= 0) {
            return;
        }

        const { isLoggedIn, token } = useAuthStore.getState();
        if (!isLoggedIn || !token) {
            return;
        }

        const secondsToSync = this.pendingSeconds;
        this.pendingSeconds = 0; // 先重置，防止请求期间重复累加

        console.log(`📤 [ListeningStatsService] 准备同步听歌时长: ${secondsToSync}秒`);

        try {
            const response = await fetch(`${urlService.baseUrl}/stats/listening-time`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ seconds: secondsToSync })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ [ListeningStatsService] 听歌时长已同步: +${secondsToSync}秒，当前总计: ${result.data?.totalListeningTime || '未知'}秒`);
            } else {
                console.error(`❌ [ListeningStatsService] 同步失败: ${response.status} ${response.statusText}`);
                this.pendingSeconds += secondsToSync; // 失败则把秒数加回去
            }
        } catch (error) {
            console.error("❌ [ListeningStatsService] 同步异常:", error);
            this.pendingSeconds += secondsToSync; // 异常也加回去
        }
    }

    /**
     * 记录歌曲播放次数
     * @param track 歌曲对象
     */
    public async recordPlayCount(track: Track) {
        const { isLoggedIn, token } = useAuthStore.getState();
        if (!isLoggedIn || !token) {
            console.warn("⚠️ [ListeningStatsService] 未登录，跳过记录播放次数");
            return;
        }

        const payload = {
            trackId: String(track.id).trim(),
            trackName: (track.name || '').trim(),
            artists: (track.artists || '').trim(),
            album: (track.album || '').trim(),
            picUrl: (track.picUrl || '').trim(),
            source: track.source
        };

        console.log(`📤 [ListeningStatsService] 正在记录播放次数:`, payload);

        try {
            const response = await fetch(`${urlService.baseUrl}/stats/play-count`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ [ListeningStatsService] 播放次数记录成功: ${track.name}`, result);
            } else {
                const errorText = await response.text();
                console.error(`❌ [ListeningStatsService] 记录播放次数失败: ${response.status} ${errorText}`);
            }
        } catch (error) {
            console.error("❌ [ListeningStatsService] 记录播放次数异常:", error);
        }
    }

    /**
     * 获取用户统计数据与播放历史
     */
    public async fetchStats() {
        const { isLoggedIn, token } = useAuthStore.getState();
        if (!isLoggedIn || !token) {
            return null;
        }

        try {
            const response = await fetch(`${urlService.baseUrl}/stats`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                return result.data;
            } else {
                console.error(`❌ [ListeningStatsService] 获取统计数据失败: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error("❌ [ListeningStatsService] 获取统计数据异常:", error);
            return null;
        }
    }

    /**
     * 获取用户对特定歌曲的回忆坐标
     * @param trackId 歌曲ID
     * @param source 音乐平台来源
     */
    public async fetchSongMemory(trackId: string | number, source: string) {
        const { isLoggedIn, token } = useAuthStore.getState();
        if (!isLoggedIn || !token) {
            return null;
        }

        try {
            const url = `${urlService.baseUrl}/stats/song-memory?trackId=${encodeURIComponent(trackId)}&source=${encodeURIComponent(source)}`;
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.code === 200) {
                    return result.data;
                }
                return null;
            } else {
                console.error(`❌ [ListeningStatsService] 获取歌曲回忆失败: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error("❌ [ListeningStatsService] 获取歌曲回忆异常:", error);
            return null;
        }
    }

    public cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
}

export const listeningStatsService = ListeningStatsService.getInstance();
