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
            // 后端返回格式: { status: 200, success: true, data: { album: { ...albumInfo, songs: [...] } } }
            if (data.status !== 200 || !data.data?.album) return null;

            const albumRaw = data.data.album;
            // songs 嵌套在 album 对象内，需要提取出来
            const songs = albumRaw.songs || [];

            // 构建 album 对象，确保 artist 字段为对象格式（页面使用 album.artist?.name）
            const album = {
                ...albumRaw,
                picUrl: albumRaw.coverImgUrl || albumRaw.picUrl || '',
                artist: typeof albumRaw.artist === 'string'
                    ? { name: albumRaw.artist }
                    : albumRaw.artist || { name: '' },
            };
            delete album.songs; // 避免重复

            return {
                album,
                songs,
            };
        } catch (error) {
            console.error('Failed to fetch album detail:', error);
            return null;
        }
    }
}

export const albumService = new AlbumService();
