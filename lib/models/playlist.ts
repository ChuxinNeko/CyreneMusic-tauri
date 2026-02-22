
import { MusicSource } from '../services/audioSourceService';
import { Track } from './track';

export interface Playlist {
    id: number;
    name: string;
    isDefault: boolean;
    trackCount: number;
    coverUrl?: string;
    createdAt: string;
    updatedAt: string;
    source?: string;
    sourcePlaylistId?: string;
}

export interface PlaylistTrack {
    trackId: string;
    name: string;
    artists: string;
    album: string;
    picUrl: string;
    source: MusicSource;
    addedAt: string;
}

export interface PlaylistSyncResult {
    insertedCount: number;
    newTracks: PlaylistTrack[];
    message: string;
}
