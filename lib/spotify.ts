import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SpotifyAlbum, SpotifyTrack, TokenData } from '@/types';

export const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
export const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
export const REDIRECT_URI = process.env.REDIRECT_URI!;

export const SCOPE = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public',
    'ugc-image-upload',
    // 'user-follow-read' and 'user-follow-modify' — needed for "Artists I
    // Follow" search and for unfollowing artists from within the app, but
    // Spotify rejects the whole auth request with invalid_scope until this
    // app's quota extension request (pending) is approved with these
    // scopes included. Re-add both once that comes through.
    // 'user-follow-read',
    // 'user-follow-modify',
].join(' ');

export function getAuthHeader() {
    return (
        'Basic ' +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    );
}

export async function getTokens(): Promise<TokenData | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get('spotify_tokens')?.value;
    if (!raw) return null;
    try {
        return JSON.parse(raw) as TokenData;
    } catch {
        return null;
    }
}

async function fetchRefreshedToken(
    refreshToken: string,
): Promise<TokenData | null> {
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: getAuthHeader(),
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? refreshToken,
        expires_at: Date.now() + data.expires_in * 1000,
    };
}

/**
 * Use this in Route Handlers only — it refreshes the token AND writes
 * the updated token back to the cookie (which requires a Route Handler context).
 */
export async function getValidAccessToken(): Promise<string> {
    const tokens = await getTokens();
    if (!tokens) redirect('/login');
    if (Date.now() > tokens.expires_at - 60_000) {
        const newTokens = await fetchRefreshedToken(tokens.refresh_token);
        if (!newTokens) redirect('/login');
        // Only set cookies in Route Handler context — this is safe here
        // because getValidAccessToken is called from API routes.
        try {
            const cookieStore = await cookies();
            cookieStore.set('spotify_tokens', JSON.stringify(newTokens), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 30,
                path: '/',
            });
        } catch {
            // In Server Component context (layout), cookie setting will fail —
            // that's okay, we still return the new access token for this request.
        }
        return newTokens.access_token;
    }
    return tokens.access_token;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function sf(path: string, token: string, options?: RequestInit) {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`Spotify ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const getCurrentUser = (t: string) => sf('/me', t);
export const getUserPlaylists = (t: string) => sf('/me/playlists?limit=50', t);
export const getPlaylist = (t: string, id: string) => sf(`/playlists/${id}`, t);

export async function getAllPlaylistTracks(
    t: string,
    playlistId: string,
): Promise<SpotifyTrack[]> {
    const all: SpotifyTrack[] = [];
    let offset = 0;
    while (true) {
        const data = await sf(
            `/playlists/${playlistId}/tracks?offset=${offset}&limit=100`,
            t,
        );
        const items = data?.items ?? [];
        if (!items.length) break;
        for (const item of items) {
            const track = item.track;
            if (!track) continue;
            all.push({
                track_name: track.name,
                track_id: track.id,
                artist_name: track.artists?.[0]?.name ?? 'Unknown',
                track_album_cover:
                    track.album?.images?.[2]?.url ??
                    track.album?.images?.[0]?.url ??
                    '',
            });
        }
        offset += items.length;
    }
    return all;
}

export async function createPlaylist(
    t: string,
    userId: string,
    name: string,
    description: string,
    isPublic: boolean,
    collaborative: boolean,
) {
    return sf(`/users/${userId}/playlists`, t, {
        method: 'POST',
        body: JSON.stringify({
            name,
            description,
            public: isPublic,
            collaborative,
        }),
    });
}

export const updatePlaylist = (
    t: string,
    id: string,
    name: string,
    description: string,
) =>
    sf(`/playlists/${id}`, t, {
        method: 'PUT',
        body: JSON.stringify({ name, description }),
    });

export const deletePlaylist = (t: string, id: string) =>
    sf(`/playlists/${id}/followers`, t, { method: 'DELETE' });

export async function addTracksToPlaylist(
    t: string,
    playlistId: string,
    trackIds: string[],
) {
    const uris = trackIds.map(id => `spotify:track:${id}`);
    for (let i = 0; i < uris.length; i += 100)
        await sf(`/playlists/${playlistId}/tracks`, t, {
            method: 'POST',
            body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
        });
}

export async function removeTracksFromPlaylist(
    t: string,
    playlistId: string,
    trackIds: string[],
) {
    const tracks = trackIds.map(id => ({ uri: `spotify:track:${id}` }));
    for (let i = 0; i < tracks.length; i += 100)
        await sf(`/playlists/${playlistId}/tracks`, t, {
            method: 'DELETE',
            body: JSON.stringify({ tracks: tracks.slice(i, i + 100) }),
        });
}

export async function getAlbumTracks(t: string, albumId: string) {
    const album = await sf(`/albums/${albumId}`, t);
    const cover = album?.images?.[2]?.url ?? album?.images?.[0]?.url ?? '';
    return (album?.tracks?.items ?? []).map(
        (s: { name: string; id: string }) => ({
            song_image: cover,
            song_name: s.name,
            song_id: s.id,
        }),
    );
}

export async function searchArtists(t: string, query: string) {
    const data = await sf(
        `/search?q=${encodeURIComponent(query)}&type=artist&limit=8`,
        t,
    );
    const items = data?.artists?.items ?? [];
    return items.map((a: any) => ({
        id: a.id,
        name: a.name,
        image:
            a.images?.[2]?.url ??
            a.images?.[1]?.url ??
            a.images?.[0]?.url ??
            '',
        followers: a.followers?.total
            ? new Intl.NumberFormat().format(a.followers.total)
            : '',
    }));
}

interface RawSpotifyArtist {
    id: string;
    name: string;
    images?: { url: string }[];
    followers?: { total: number };
}

export async function searchFollowedArtists(t: string, query: string) {
    const all: RawSpotifyArtist[] = [];
    let after: string | undefined;
    while (true) {
        const data = await sf(
            `/me/following?type=artist&limit=50${after ? `&after=${after}` : ""}`,
            t,
        );
        const items: RawSpotifyArtist[] = data?.artists?.items ?? [];
        all.push(...items);
        after = data?.artists?.cursors?.after ?? undefined;
        if (!after || !items.length) break;
    }

    const q = query.trim().toLowerCase();
    const matches = q ? all.filter(a => a.name.toLowerCase().includes(q)) : all;
    matches.sort((a, b) => a.name.localeCompare(b.name));

    return matches.map(a => ({
        id: a.id,
        name: a.name,
        image:
            a.images?.[2]?.url ??
            a.images?.[1]?.url ??
            a.images?.[0]?.url ??
            '',
        followers: a.followers?.total
            ? new Intl.NumberFormat().format(a.followers.total)
            : '',
    }));
}

/**
 * Spotify's release_date_precision can be 'year', 'month', or 'day', so
 * release_date itself may be "2020", "2020-05", or "2020-05-15". Pad it out
 * to a full YYYY-MM-DD so two releases can be compared/sorted to the day.
 */
function toPreciseDate(releaseDate: string, precision?: string): string {
    if (precision === 'day' || releaseDate.length === 10) return releaseDate;
    if (precision === 'month' || releaseDate.length === 7)
        return `${releaseDate}-01`;
    return `${releaseDate.slice(0, 4)}-01-01`;
}

export async function getArtistAlbums(
    t: string,
    artistId: string,
): Promise<SpotifyAlbum[]> {
    const all: SpotifyAlbum[] = [];
    let offset = 0;
    while (true) {
        const data = await sf(
            `/artists/${artistId}/albums?include_groups=album,single&limit=50&offset=${offset}`,
            t,
        );
        const items = data?.items ?? [];
        if (!items.length) break;
        for (const a of items) {
            if (a.album_type === 'compilation') continue;
            const year =
                a.release_date.length === 4
                    ? a.release_date
                    : new Date(a.release_date).getFullYear().toString();
            all.push({
                album_name: a.name,
                album_id: a.id,
                album_cover_image:
                    a.images?.[2]?.url ?? a.images?.[0]?.url ?? '',
                album_type: a.album_type,
                total_tracks: a.total_tracks,
                release_date: year,
                release_date_precise: toPreciseDate(
                    a.release_date,
                    a.release_date_precision,
                ),
                songs: [],
            });
        }
        offset += items.length;
        if (offset >= 500) break;
    }

    const map = new Map<string, SpotifyAlbum>();
    for (const a of all) {
        const ex = map.get(a.album_name);
        if (!ex || a.release_date_precise > ex.release_date_precise)
            map.set(a.album_name, a);
    }

    return [...map.values()].sort((a, b) => {
        if (a.album_type !== b.album_type)
            return a.album_type === 'album' ? -1 : 1;
        return b.release_date_precise.localeCompare(a.release_date_precise);
    });
}
