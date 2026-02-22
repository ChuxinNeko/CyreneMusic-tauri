
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

    public async addTracksToPlaylist(
        playlistId: string | number,
        tracks: { trackId: string | number; name: string; artists: string; album: string; picUrl: string; source: string }[]
    ): Promise<boolean> {
        try {
            const response = await fetch(`${urlService.baseUrl}/playlists/${playlistId}/tracks/batch`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ tracks })
            });
            return response.ok;
        } catch (error) {
            console.error("[PlaylistService] addTracksToPlaylist failed:", error);
            return false;
        }
    }
}

export const playlistService = PlaylistService.getInstance();
