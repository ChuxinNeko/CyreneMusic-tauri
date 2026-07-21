import { urlService } from "./urlService";
import { useAuthStore } from "../store/useAuthStore";
import { MusicSource } from "./audioSourceService";
import { Track } from "../models/track";
import { apiFetch } from "./apiClient";

export enum MusicPlatform {
    netease = "netease",
    qq = "qq",
    kugou = "kugou",
    kuwo = "kuwo",
    apple = "apple"
}

export const PLATFORM_CONFIG: Record<MusicPlatform, { name: string; icon: string }> = {
    [MusicPlatform.netease]: { name: "网易云音乐", icon: "🎵" },
    [MusicPlatform.qq]: { name: "QQ音乐", icon: "🎶" },
    [MusicPlatform.kugou]: { name: "酷狗音乐", icon: "🎸" },
    [MusicPlatform.kuwo]: { name: "酷我音乐", icon: "🎤" },
    [MusicPlatform.apple]: { name: "Apple Music", icon: "🍎" }
};

export interface ExternalPlaylist {
    id: string;
    name: string;
    coverImgUrl: string;
    creator?: string;
    trackCount: number;
    description?: string;
    tracks: Track[];
    platform: MusicPlatform;
}

class PlaylistImportService {
    private static instance: PlaylistImportService;

    private constructor() { }

    public static getInstance(): PlaylistImportService {
        if (!PlaylistImportService.instance) {
            PlaylistImportService.instance = new PlaylistImportService();
        }
        return PlaylistImportService.instance;
    }

    private getHeaders() {
        const { token } = useAuthStore.getState();
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
    }

    public parsePlaylistId(platform: MusicPlatform, input: string): string | null {
        const trimmed = input.trim();
        if (/^\d+$/.test(trimmed) && platform !== MusicPlatform.apple) {
            return trimmed;
        }

        try {
            switch (platform) {
                case MusicPlatform.netease:
                    return this.parseNeteaseId(trimmed);
                case MusicPlatform.qq:
                    return this.parseQQId(trimmed);
                case MusicPlatform.kuwo:
                    return this.parseKuwoId(trimmed);
                case MusicPlatform.apple:
                    return this.parseAppleId(trimmed);
                default:
                    return null;
            }
        } catch (e) {
            return null;
        }
    }

    private parseNeteaseId(url: string): string | null {
        const match = url.match(/[?&]id=(\d+)/);
        if (match) return match[1];
        if (url.includes("music.163.com/playlist/")) {
            const parts = url.split("/playlist/");
            const id = parts[1]?.split("?")[0];
            if (/^\d+$/.test(id)) return id;
        }
        return null;
    }

    private parseQQId(url: string): string | null {
        // Example: https://y.qq.com/n/ryqq/playlist/8522515502
        const match = url.match(/[?&](?:id=|playlist\/)(\d+)/) || url.match(/\/playlist\/(\d+)/);
        return match ? match[1] : null;
    }

    private parseKuwoId(url: string): string | null {
        const match = url.match(/playlist_detail\/(\d+)/);
        return match ? match[1] : null;
    }

    private parseAppleId(url: string): string | null {
        if (url.startsWith("pl.")) return url;
        const match = url.match(/(pl\.[a-zA-Z0-9\-]+)/);
        return match ? match[1] : null;
    }

    public async fetchExternalPlaylist(platform: MusicPlatform, playlistId: string): Promise<ExternalPlaylist | null> {
        const { token } = useAuthStore.getState();
        let apiUrl = "";

        switch (platform) {
            case MusicPlatform.netease:
                apiUrl = `${urlService.baseUrl}/playlist?id=${playlistId}&limit=1000`;
                break;
            case MusicPlatform.qq:
                apiUrl = `${urlService.baseUrl}/qq/playlist?id=${playlistId}&limit=1000`;
                break;
            case MusicPlatform.kuwo:
                apiUrl = `${urlService.baseUrl}/kuwo/playlist?pid=${playlistId}&limit=500`;
                break;
            case MusicPlatform.apple:
                apiUrl = `${urlService.baseUrl}/apple/playlist?id=${playlistId}`;
                break;
            default:
                return null;
        }

        try {
            const response = await apiFetch(apiUrl, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });
            const result = await response.json();

            if (result.success || (result.status === 200 && result.data)) {
                const data = result.data.playlist || result.data;
                // Basic mapping, needs adjustment based on actual API response structure per platform
                return {
                    id: playlistId,
                    name: data.name,
                    coverImgUrl: data.coverImgUrl || data.picUrl || data.pic,
                    creator: data.creator?.nickname || data.creator,
                    trackCount: data.trackCount || (data.tracks ? data.tracks.length : 0),
                    description: data.description || data.intro,
                    tracks: (data.tracks || []).map((t: any) => this.convertToTrack(t, platform)),
                    platform
                };
            }
            return null;
        } catch (e) {
            console.error(`[PlaylistImportService] fetchExternalPlaylist failed for ${platform}:`, e);
            return null;
        }
    }

    private convertToTrack(song: any, platform: MusicPlatform): Track {
        // Reuse or adapt discoveryService.convertToTrack logic
        const artistsData = song.ar || song.artists || [];
        const artists = Array.isArray(artistsData)
            ? artistsData.map((a: any) => (typeof a === "string" ? a : a.name)).join(" / ")
            : String(artistsData);

        return {
            id: song.id || song.trackId || song.hash, // hash for kugou
            name: song.name || song.trackName,
            artists: artists,
            album: song.al?.name || song.album?.name || song.albumName || "",
            picUrl: song.al?.picUrl || song.album?.picUrl || song.picUrl || song.pic || "",
            source: this.mapPlatformToSource(platform),
            duration: (song.dt || song.duration || 0) / (song.dt ? 1000 : 1)
        };
    }

    private mapPlatformToSource(platform: MusicPlatform): MusicSource {
        switch (platform) {
            case MusicPlatform.netease: return MusicSource.Netease;
            case MusicPlatform.qq: return MusicSource.QQ;
            case MusicPlatform.kugou: return MusicSource.Kugou;
            default: return MusicSource.Netease;
        }
    }

    public async addTracksToLocalPlaylist(playlistId: number, tracks: Track[]): Promise<number> {
        // Since we don't have a batch add API in playlistService yet, we might need one or call multiple times.
        // Assuming there's a backend endpoint or we handle it in playlistService.
        // Let's check playlistService again.
        return 0; // Placeholder
    }
}

export const playlistImportService = PlaylistImportService.getInstance();
