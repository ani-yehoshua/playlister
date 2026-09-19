"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Search,
    Plus,
    ChevronDown,
    ChevronUp,
    Loader2,
    CheckCircle2,
    Music,
    X,
} from "lucide-react";
import type { SpotifyAlbum, SpotifySong } from "@/types";

interface Artist {
    id: string;
    name: string;
    image: string;
    followers: string;
}

type AlbumWithSongs = SpotifyAlbum & {
    songs: SpotifySong[];
    songsLoaded: boolean;
};

type SearchScope = "all" | "following";

export default function SearchPage() {
    const { id: playlistId } = useParams<{ id: string }>();
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<SearchScope>("all");
    const [artists, setArtists] = useState<Artist[]>([]);
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
    const [albums, setAlbums] = useState<AlbumWithSongs[]>([]);
    const [searching, setSearching] = useState(false);
    const [loadingAlbums, setLoadingAlbums] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
    const [loadingSongs, setLoadingSongs] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
    const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
    const [playlistName, setPlaylistName] = useState("");
    const [addingAll, setAddingAll] = useState(false);

    useEffect(() => {
        fetch(`/api/playlist/${playlistId}`)
            .then(r => r.json())
            .then(d => setPlaylistName(d.playlist?.name ?? ""));
    }, [playlistId]);

    async function runSearch(q: string, searchScope: SearchScope) {
        // Browsing followed artists doesn't require a query — an empty
        // query lists the user's full following list, alphabetized.
        if (!q && searchScope !== "following") return;
        setSearching(true);
        setSearchError("");
        setArtists([]);
        setSelectedArtist(null);
        setAlbums([]);
        try {
            const res = await fetch(
                `/api/search?artists=true&scope=${searchScope}&q=${encodeURIComponent(q)}`,
            );
            const data = await res.json();
            if (!res.ok) {
                setSearchError(data.error ?? "Search failed.");
                return;
            }
            setArtists(data.artists ?? []);
            if ((data.artists ?? []).length === 0) {
                setSearchError(
                    searchScope === "following"
                        ? q
                            ? "No followed artists match. Try a different name."
                            : "You aren't following any artists yet."
                        : "No artists found. Try a different name.",
                );
            }
        } finally {
            setSearching(false);
        }
    }

    async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        await runSearch(query.trim(), scope);
    }

    function changeScope(next: SearchScope) {
        setScope(next);
        const q = query.trim();
        if (q || next === "following") runSearch(q, next);
    }

    function clearQuery() {
        setQuery("");
        setSearchError("");
        if (scope === "following") {
            runSearch("", "following");
        } else {
            setArtists([]);
            setSelectedArtist(null);
            setAlbums([]);
        }
    }

    async function selectArtist(artist: Artist) {
        setSelectedArtist(artist);
        setAlbums([]);
        setExpandedAlbumId(null);
        setLoadingAlbums(true);
        try {
            const res = await fetch(`/api/search?artistId=${artist.id}`);
            const data = await res.json();
            if (!res.ok) {
                setSearchError(data.error ?? "Failed to load albums.");
                return;
            }
            setAlbums(
                (data.albums ?? []).map((a: SpotifyAlbum) => ({
                    ...a,
                    songs: [],
                    songsLoaded: false,
                })),
            );
        } finally {
            setLoadingAlbums(false);
        }
    }

    function clearArtist() {
        setSelectedArtist(null);
        setAlbums([]);
        setExpandedAlbumId(null);
    }

    async function toggleAlbum(albumId: string) {
        if (expandedAlbumId === albumId) {
            setExpandedAlbumId(null);
            return;
        }
        setExpandedAlbumId(albumId);
        const album = albums.find(a => a.album_id === albumId);
        if (!album || album.songsLoaded) return;
        setLoadingSongs(albumId);
        try {
            const res = await fetch(`/api/search?albumId=${albumId}`);
            const data = await res.json();
            setAlbums(prev =>
                prev.map(a =>
                    a.album_id === albumId
                        ? { ...a, songs: data.songs ?? [], songsLoaded: true }
                        : a,
                ),
            );
        } finally {
            setLoadingSongs(null);
        }
    }

    async function addTrack(trackId: string) {
        if (addedIds.has(trackId) || addingIds.has(trackId)) return;
        setAddingIds(prev => new Set(prev).add(trackId));
        try {
            await fetch(`/api/playlist/${playlistId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addTrackIds: [trackId] }),
            });
            setAddedIds(prev => new Set(prev).add(trackId));
        } finally {
            setAddingIds(prev => {
                const n = new Set(prev);
                n.delete(trackId);
                return n;
            });
        }
    }

    async function addAlbum(albumId: string) {
        if (addedIds.has(albumId) || addingIds.has(albumId)) return;
        setAddingIds(prev => new Set(prev).add(albumId));
        const album = albums.find(a => a.album_id === albumId);
        try {
            let songs = album?.songs ?? [];
            if (!album?.songsLoaded) {
                const res = await fetch(`/api/search?albumId=${albumId}`);
                const data = await res.json();
                songs = data.songs ?? [];
                setAlbums(prev =>
                    prev.map(a =>
                        a.album_id === albumId
                            ? { ...a, songs, songsLoaded: true }
                            : a,
                    ),
                );
            }
            await fetch(`/api/playlist/${playlistId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    addTrackIds: songs.map((s: SpotifySong) => s.song_id),
                }),
            });
            setAddedIds(prev => new Set(prev).add(albumId));
        } finally {
            setAddingIds(prev => {
                const n = new Set(prev);
                n.delete(albumId);
                return n;
            });
        }
    }

    async function addAllForArtist() {
        if (!selectedArtist || albums.length === 0) return;
        const artistId = selectedArtist.id;
        if (addingAll || addedIds.has(artistId) || addingIds.has(artistId))
            return;
        setAddingAll(true);
        setAddingIds(prev => new Set(prev).add(artistId));
        try {
            // Load songs for every album that hasn't been fetched yet.
            const loaded: AlbumWithSongs[] = await Promise.all(
                albums.map(async (album): Promise<AlbumWithSongs> => {
                    if (album.songsLoaded) return album;
                    const res = await fetch(
                        `/api/search?albumId=${album.album_id}`,
                    );
                    const data = await res.json();
                    return {
                        ...album,
                        songs: (data.songs ?? []) as SpotifySong[],
                        songsLoaded: true,
                    };
                }),
            );
            setAlbums(loaded);

            // Default order: oldest release first, newest last — sorted to
            // the day so same-year releases still land in the right spot.
            const ordered = [...loaded].sort((a, b) =>
                a.release_date_precise.localeCompare(b.release_date_precise),
            );
            const trackIds = ordered.flatMap(a =>
                a.songs.map(s => s.song_id),
            );

            await fetch(`/api/playlist/${playlistId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addTrackIds: trackIds }),
            });
            setAddedIds(prev => {
                const n = new Set(prev);
                n.add(artistId);
                for (const a of loaded) {
                    n.add(a.album_id);
                    for (const s of a.songs) n.add(s.song_id);
                }
                return n;
            });
        } finally {
            setAddingIds(prev => {
                const n = new Set(prev);
                n.delete(artistId);
                return n;
            });
            setAddingAll(false);
        }
    }

    return (
        <div className='max-w-2xl mx-auto space-y-6 pb-12'>
            {/* Header */}
            <div className='flex items-center gap-3'>
                <Button
                    asChild
                    variant='ghost'
                    size='icon'>
                    <Link href={`/playlist/${playlistId}`}>
                        <ArrowLeft className='w-4 h-4' />
                    </Link>
                </Button>
                <div>
                    <h1 className='text-2xl font-bold tracking-tight'>
                        Add Songs
                    </h1>
                    {playlistName && (
                        <p className='text-sm text-muted-foreground'>
                            Adding to &quot;{playlistName}&quot;
                        </p>
                    )}
                </div>
            </div>

            {/* Search bar */}
            <form
                onSubmit={handleSearch}
                className='flex gap-2'>
                <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none' />
                    <input
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            if (!e.target.value) clearQuery();
                        }}
                        placeholder={
                            scope === "following"
                                ? "Search artists you follow…"
                                : "Search for an artist…"
                        }
                        autoComplete='off'
                        className='search-field flex h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    />
                    {query && (
                        <button
                            type='button'
                            onClick={clearQuery}
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'>
                            <X className='w-4 h-4' />
                        </button>
                    )}
                </div>
                <Button
                    type='submit'
                    disabled={
                        searching || (!query.trim() && scope !== "following")
                    }>
                    {searching ? (
                        <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                        "Search"
                    )}
                </Button>
            </form>

            {/* Search scope */}
            <div className='flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 p-1 w-fit'>
                <button
                    type='button'
                    onClick={() => changeScope("all")}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        scope === "all"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    }`}>
                    All of Spotify
                </button>
                <button
                    type='button'
                    onClick={() => changeScope("following")}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        scope === "following"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    }`}>
                    Artists I Follow
                </button>
            </div>

            {searchError && (
                <p className='text-sm text-destructive'>{searchError}</p>
            )}

            {/* Tip */}
            {artists.length === 0 && !searching && !searchError && (
                <div className='rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground space-y-1'>
                    <p className='font-medium text-foreground'>How to use</p>
                    <p>1. Search for an artist by name.</p>
                    <p>2. Pick the right artist from the results.</p>
                    <p>
                        3. Expand an album to browse songs, or add a whole album
                        at once with <Plus className='inline w-3 h-3' />.
                    </p>
                </div>
            )}

            {/* Artist results */}
            {!selectedArtist && artists.length > 0 && (
                <div className='space-y-2'>
                    <p className='text-xs text-muted-foreground uppercase tracking-wider px-1'>
                        Select an artist
                    </p>
                    {artists.map(artist => (
                        <button
                            key={artist.id}
                            onClick={() => selectArtist(artist)}
                            className='w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors text-left'>
                            <div className='relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-muted'>
                                {artist.image ? (
                                    <Image
                                        src={artist.image}
                                        alt={artist.name}
                                        fill
                                        className='object-cover'
                                        sizes='48px'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center'>
                                        <Music className='w-5 h-5 text-muted-foreground' />
                                    </div>
                                )}
                            </div>
                            <div className='min-w-0'>
                                <p className='text-sm font-medium truncate'>
                                    {artist.name}
                                </p>
                                {artist.followers && (
                                    <p className='text-xs text-muted-foreground'>
                                        {artist.followers} followers
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Selected artist header */}
            {selectedArtist && (
                <div className='flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5'>
                    <div className='relative w-10 h-10 shrink-0 rounded-full overflow-hidden bg-muted'>
                        {selectedArtist.image ? (
                            <Image
                                src={selectedArtist.image}
                                alt={selectedArtist.name}
                                fill
                                className='object-cover'
                                sizes='40px'
                            />
                        ) : (
                            <div className='w-full h-full flex items-center justify-center'>
                                <Music className='w-4 h-4 text-muted-foreground' />
                            </div>
                        )}
                    </div>
                    <div className='flex-1 min-w-0'>
                        <p className='text-sm font-semibold truncate'>
                            {selectedArtist.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            {loadingAlbums
                                ? "Loading catalog…"
                                : `${albums.length} releases`}
                        </p>
                    </div>
                    {!loadingAlbums && albums.length > 0 && (
                        <button
                            onClick={addAllForArtist}
                            disabled={addingAll || addedIds.has(selectedArtist.id)}
                            title='Add all songs by this artist'
                            className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${addedIds.has(selectedArtist.id) ? "text-primary" : "text-muted-foreground"} disabled:opacity-50`}>
                            {addingAll ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : addedIds.has(selectedArtist.id) ? (
                                <CheckCircle2 className='w-4 h-4' />
                            ) : (
                                <Plus className='w-4 h-4' />
                            )}
                        </button>
                    )}
                    <button
                        onClick={clearArtist}
                        className='shrink-0 text-muted-foreground hover:text-foreground transition-colors'
                        title='Change artist'>
                        <X className='w-4 h-4' />
                    </button>
                </div>
            )}

            {/* Loading albums */}
            {loadingAlbums && (
                <div className='flex justify-center py-8'>
                    <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
                </div>
            )}

            {/* Album list */}
            {!loadingAlbums && albums.length > 0 && (
                <div className='space-y-2'>
                    {albums.map(album => {
                        const isExpanded = expandedAlbumId === album.album_id;
                        const albumAdded = addedIds.has(album.album_id);
                        const albumAdding = addingIds.has(album.album_id);
                        return (
                            <div
                                key={album.album_id}
                                className='rounded-lg border border-border/50 overflow-hidden'>
                                <div className='flex items-center gap-3 p-3 bg-card'>
                                    <div
                                        className='relative w-12 h-12 shrink-0 rounded overflow-hidden bg-muted cursor-pointer'
                                        onClick={() =>
                                            toggleAlbum(album.album_id)
                                        }>
                                        {album.album_cover_image ? (
                                            <Image
                                                src={album.album_cover_image}
                                                alt={album.album_name}
                                                fill
                                                className='object-cover'
                                                sizes='48px'
                                            />
                                        ) : (
                                            <div className='w-full h-full flex items-center justify-center'>
                                                <Music className='w-5 h-5 text-muted-foreground' />
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className='flex-1 min-w-0 cursor-pointer'
                                        onClick={() =>
                                            toggleAlbum(album.album_id)
                                        }>
                                        <p className='text-sm font-medium leading-snug break-words'>
                                            {album.album_name}
                                        </p>
                                        <div className='flex items-center gap-2 mt-0.5'>
                                            <span className='text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5'>
                                                {album.release_date}
                                            </span>
                                            <span className='text-xs text-muted-foreground'>
                                                {album.total_tracks} tracks
                                            </span>
                                        </div>
                                    </div>
                                    <div className='flex items-center gap-1 shrink-0'>
                                        <button
                                            onClick={() =>
                                                addAlbum(album.album_id)
                                            }
                                            disabled={albumAdded || albumAdding}
                                            title='Add whole album'
                                            className={`h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${albumAdded ? "text-primary" : "text-muted-foreground"} disabled:opacity-50`}>
                                            {albumAdding ? (
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                            ) : albumAdded ? (
                                                <CheckCircle2 className='w-4 h-4' />
                                            ) : (
                                                <Plus className='w-4 h-4' />
                                            )}
                                        </button>
                                        <button
                                            onClick={() =>
                                                toggleAlbum(album.album_id)
                                            }
                                            className='h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground'>
                                            {isExpanded ? (
                                                <ChevronUp className='w-4 h-4' />
                                            ) : (
                                                <ChevronDown className='w-4 h-4' />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className='bg-muted/20'>
                                        <div className='h-px bg-border' />
                                        {loadingSongs === album.album_id ? (
                                            <div className='flex justify-center py-6'>
                                                <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
                                            </div>
                                        ) : (
                                            <div className='divide-y divide-border/40'>
                                                {album.songs.map((song, i) => {
                                                    const songAdded =
                                                        addedIds.has(
                                                            song.song_id,
                                                        );
                                                    const songAdding =
                                                        addingIds.has(
                                                            song.song_id,
                                                        );
                                                    return (
                                                        <div
                                                            key={song.song_id}
                                                            className='flex items-center gap-3 px-4 py-2 hover:bg-muted/40 transition-colors'>
                                                            <span className='text-xs text-muted-foreground w-5 text-right shrink-0'>
                                                                {i + 1}
                                                            </span>
                                                            <div className='relative w-8 h-8 shrink-0 rounded overflow-hidden bg-muted'>
                                                                {song.song_image && (
                                                                    <Image
                                                                        src={
                                                                            song.song_image
                                                                        }
                                                                        alt={
                                                                            song.song_name
                                                                        }
                                                                        fill
                                                                        className='object-cover'
                                                                        sizes='32px'
                                                                    />
                                                                )}
                                                            </div>
                                                            <span className='flex-1 text-sm break-words leading-snug'>
                                                                {song.song_name}
                                                            </span>
                                                            <button
                                                                onClick={() =>
                                                                    addTrack(
                                                                        song.song_id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    songAdded ||
                                                                    songAdding
                                                                }
                                                                className={`h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0 ${songAdded ? "text-primary" : "text-muted-foreground"} disabled:opacity-50`}>
                                                                {songAdding ? (
                                                                    <Loader2 className='w-3.5 h-3.5 animate-spin' />
                                                                ) : songAdded ? (
                                                                    <CheckCircle2 className='w-3.5 h-3.5' />
                                                                ) : (
                                                                    <Plus className='w-3.5 h-3.5' />
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
