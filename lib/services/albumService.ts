import { urlService } from './urlService';

export interface AlbumDetailInfo {
    album: any;
    songs: any[];
}

class AlbumService {
    async fetchAlbumDetail(id: number | string): Promise<AlbumDetailInfo | null> {
        try {
            const url = `${urlService.baseUrl}/album?id=${id}`;
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (data.code !== 200) return null;

            return {
                album: data.album,
                songs: data.songs || [],
            };
        } catch (error) {
            console.error('Failed to fetch album detail:', error);
            return null;
        }
    }
}

export const albumService = new AlbumService();
