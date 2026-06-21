
import { urlService } from "./urlService";
import { useAuthStore } from "../store/useAuthStore";
import { Playlist, PlaylistTrack, PlaylistSyncResult } from "../models/playlist";

class PlaylistService {
    private static instance: PlaylistService;

    private constructor() { }

    public static getInstance(): PlaylistService {
        if (!PlaylistService.instance) {
            PlaylistService.instance = new PlaylistService();
        }
        return PlaylistService.instance;
    }

    private getHeaders() {
        const { token } = useAuthStore.getState();
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
    }

    public async getPlaylists(): Promise<Playlist[]> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists`, {
                headers: this.getHeaders()
            });
            if (response.ok) {
                const result = await response.json();
                return result.playlists || [];
            }
            return [];
        } catch (error) {
            console.error("[PlaylistService] getPlaylists failed:", error);
            return [];
        }
    }

    public async createPlaylist(name: string, options?: { source?: string; sourcePlaylistId?: string }): Promise<Playlist | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ name, ...options })
            });
            if (response.ok) {
                const result = await response.json();
                return result.playlist;
            }
            return null;
        } catch (error) {
            console.error("[PlaylistService] createPlaylist failed:", error);
            return null;
        }
    }

    public async deletePlaylist(playlistId: string | number): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/delete`, {
                method: "POST",
                headers: this.getHeaders()
            });
            return response.ok;
        } catch (error) {
            console.error("[PlaylistService] deletePlaylist failed:", error);
            return false;
        }
    }

    public async getPlaylistTracks(playlistId: string | number): Promise<PlaylistTrack[]> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/tracks`, {
                headers: this.getHeaders()
            });
            if (response.ok) {
                const result = await response.json();
                return (result.tracks || []).map((t: any) => ({
                    trackId: t.trackId || t.track_id || t.id,
                    name: t.name || t.track_name,
                    artists: t.artists,
                    album: t.album,
                    picUrl: t.picUrl || t.pic_url,
                    source: t.source,
                    addedAt: t.addedAt || t.added_at
                }));
            }
            return [];
        } catch (error) {
            console.error("[PlaylistService] getPlaylistTracks failed:", error);
            return [];
        }
    }

    public async addTracksToPlaylist(
        playlistId: string | number,
        tracks: { trackId: string | number; name: string; artists: string; album: string; picUrl: string; source: string }[]
    ): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/tracks/batch`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ 
                    tracks: tracks.map(t => ({
                        ...t,
                        trackId: String(t.trackId)
                    }))
                })
            });
            return response.ok;
        } catch (error) {
            console.error("[PlaylistService] addTracksToPlaylist failed:", error);
            return false;
        }
    }

    public async addTrackToPlaylist(
        playlistId: string | number,
        trackId: string | number,
        name: string,
        artists: string,
        album: string,
        picUrl: string,
        source: string
    ): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/tracks`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ trackId: String(trackId), name, artists, album, picUrl, source })
            });
            return response.ok;
        } catch (error) {
            console.error("[PlaylistService] addTrackToPlaylist failed:", error);
            return false;
        }
    }

    public async removeTrackFromPlaylist(
        playlistId: string | number,
        trackId: string | number,
        source: string
    ): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/tracks/remove`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ trackId: String(trackId), source })
            });
            return response.ok;
        } catch (error) {
            console.error("[PlaylistService] removeTrackFromPlaylist failed:", error);
            return false;
        }
    }

    /**
     * 同步第三方歌单：重新拉取远端歌单数据，增量更新本地歌单
     */
    public async syncPlaylist(playlistId: string | number): Promise<PlaylistSyncResult | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/sync`, {
                method: "POST",
                headers: this.getHeaders()
            });
            if (response.ok) {
                const result = await response.json();
                return result as PlaylistSyncResult;
            }
            return null;
        } catch (error) {
            console.error("[PlaylistService] syncPlaylist failed:", error);
            return null;
        }
    }

    /**
     * 检查歌曲是否在用户的任何歌单中
     */
    public async checkTrackInPlaylists(trackId: string | number, source: string): Promise<{ inPlaylist: boolean; playlistIds: number[]; playlistNames: string[] }> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/check-track?trackId=${String(trackId)}&source=${source}`, {
                headers: this.getHeaders()
            });
            if (response.ok) {
                return await response.json();
            }
            return { inPlaylist: false, playlistIds: [], playlistNames: [] };
        } catch (error) {
            console.error("[PlaylistService] checkTrackInPlaylists failed:", error);
            return { inPlaylist: false, playlistIds: [], playlistNames: [] };
        }
    }
}

export const playlistService = PlaylistService.getInstance();
