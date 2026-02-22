
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

    public async createPlaylist(name: string): Promise<Playlist | null> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ name })
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
                return result.tracks || [];
            }
            return [];
        } catch (error) {
            console.error("[PlaylistService] getPlaylistTracks failed:", error);
            return [];
        }
    }

    public async syncPlaylist(playlistId: string | number): Promise<PlaylistSyncResult> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/sync`, {
                method: "POST",
                headers: this.getHeaders()
            });
            if (response.ok) {
                const result = await response.json();
                return {
                    insertedCount: result.insertedCount || 0,
                    newTracks: result.newTracks || [],
                    message: result.message || ""
                };
            }
            return { insertedCount: 0, newTracks: [], message: "请求失败" };
        } catch (error) {
            console.error("[PlaylistService] syncPlaylist failed:", error);
            return { insertedCount: 0, newTracks: [], message: "发生错误" };
        }
    }
}

export const playlistService = PlaylistService.getInstance();
