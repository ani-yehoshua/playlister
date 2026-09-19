export interface SpotifyUser {
    id: string;
    display_name: string;
    images: { url: string }[];
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string;
    images: { url: string }[];
    owner: { display_name: string; id: string };
    public: boolean;
    collaborative: boolean;
}

export interface SpotifyTrack {
    track_name: string;
    track_id: string;
    artist_name: string;
    track_album_cover: string;
}

export interface SpotifyAlbum {
    album_name: string;
    album_id: string;
    album_cover_image: string;
    album_type: string;
    total_tracks: number;
    release_date: string;
    /** Full YYYY-MM-DD release date (padded to the 1st when Spotify only
     *  reports year/month precision) — sortable to the day. */
    release_date_precise: string;
    songs: SpotifySong[];
}

export interface SpotifySong {
    song_image: string;
    song_name: string;
    song_id: string;
}

export interface TokenData {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}
