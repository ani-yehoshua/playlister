import { NextResponse } from 'next/server';
import {
    getValidAccessToken,
    searchArtists,
    searchFollowedArtists,
    getArtistAlbums,
    getAlbumTracks,
} from '@/lib/spotify';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const artistsMode = searchParams.get('artists') === 'true';
    const scope = searchParams.get('scope') === 'following' ? 'following' : 'all';
    const artistId = searchParams.get('artistId');
    const albumId = searchParams.get('albumId');

    try {
        const token = await getValidAccessToken();

        // Get tracks for a specific album
        if (albumId) {
            const songs = await getAlbumTracks(token, albumId);
            return NextResponse.json({ songs });
        }

        // Get albums for a specific artist (by ID)
        if (artistId) {
            const albums = await getArtistAlbums(token, artistId);
            return NextResponse.json({ albums });
        }

        // Search for multiple matching artists. Followed-artist browsing
        // doesn't require a query — an empty query lists the full,
        // alphabetized following list.
        if (artistsMode && (query || scope === 'following')) {
            const artists =
                scope === 'following'
                    ? await searchFollowedArtists(token, query ?? '')
                    : await searchArtists(token, query!);
            return NextResponse.json({ artists });
        }

        return NextResponse.json(
            { error: 'Missing query parameters' },
            { status: 400 },
        );
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
