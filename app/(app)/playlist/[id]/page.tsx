"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Pencil,
    Trash2,
    Plus,
    Music,
    Loader2,
    ArrowUp,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import type { SpotifyTrack } from "@/types";

export default function PlaylistPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [data, setData] = useState<{
        playlist: any;
        tracks: SpotifyTrack[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch(`/api/playlist/${id}`).then(r => r.json()),
            fetch("/api/playlists").then(r => r.json()),
        ])
            .then(([playlistData, userData]) => {
                setData(playlistData);
                setCurrentUserId(userData.user?.id ?? null);
            })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        const handleScroll = () => setShowBackToTop(window.scrollY > 400);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    async function handleDelete() {
        setDeleting(true);
        await fetch(`/api/playlist/${id}`, { method: "DELETE" });
        router.push("/dashboard");
        router.refresh();
    }

    if (loading)
        return (
            <div className='flex justify-center items-center py-32'>
                <Loader2 className='w-6 h-6 animate-spin text-muted-foreground' />
            </div>
        );
    if (!data)
        return (
            <p className='text-muted-foreground text-center py-16'>
                Playlist not found.
            </p>
        );

    const { playlist, tracks } = data;
    const isOwner = currentUserId === playlist?.owner?.id;
    const coverUrl = playlist?.images?.[0]?.url;

    return (
        <div className='space-y-6 pb-16'>
            <Button
                asChild
                variant='ghost'
                size='sm'
                className='-ml-2'>
                <Link href='/dashboard'>
                    <ArrowLeft className='w-4 h-4 mr-2' />
                    Back
                </Link>
            </Button>

            {/* Hero */}
            <div className='flex flex-col sm:flex-row gap-6 items-start'>
                <div className='relative w-44 h-44 shrink-0 rounded-lg overflow-hidden bg-muted shadow-lg'>
                    {coverUrl ? (
                        <Image
                            src={coverUrl}
                            alt={playlist.name}
                            fill
                            className='object-cover'
                            sizes='176px'
                        />
                    ) : (
                        <div className='w-full h-full flex items-center justify-center'>
                            <Music className='w-12 h-12 text-muted-foreground' />
                        </div>
                    )}
                </div>
                <div className='flex flex-col justify-end gap-3'>
                    <div>
                        <p className='text-xs text-muted-foreground uppercase tracking-widest mb-1'>
                            Playlist
                        </p>
                        <h1 className='text-3xl font-bold tracking-tight'>
                            {playlist.name}
                        </h1>
                        {playlist.description && (
                            <p className='text-sm text-muted-foreground mt-1'>
                                {playlist.description}
                            </p>
                        )}
                        <p className='text-xs text-muted-foreground mt-2'>
                            {tracks.length} tracks
                        </p>
                    </div>
                    <div className='flex gap-2 flex-wrap'>
                        <Button
                            asChild
                            size='sm'>
                            <Link href={`/search/${id}`}>
                                <Plus className='w-4 h-4 mr-2' />
                                Add Songs
                            </Link>
                        </Button>
                        {isOwner && (
                            <Button
                                asChild
                                variant='outline'
                                size='sm'>
                                <Link href={`/edit/${id}`}>
                                    <Pencil className='w-4 h-4 mr-2' />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        <Button
                            variant='destructive'
                            size='sm'
                            onClick={() => setDeleteOpen(true)}>
                            <Trash2 className='w-4 h-4 mr-2' />
                            {isOwner ? "Delete" : "Unfollow"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className='h-px bg-border' />

            {/* Track list */}
            {tracks.length === 0 ? (
                <div className='flex flex-col items-center py-16 gap-3 text-center'>
                    <Music className='w-10 h-10 text-muted-foreground' />
                    <p className='text-muted-foreground text-sm'>
                        This playlist is empty.
                    </p>
                    <Button
                        asChild
                        size='sm'>
                        <Link href={`/search/${id}`}>
                            <Plus className='w-4 h-4 mr-2' />
                            Add Songs
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className='space-y-0.5'>
                    {tracks.map((track, i) => (
                        <div
                            key={`${track.track_id}-${i}`}
                            className='flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition-colors'>
                            <span className='w-6 text-center text-sm text-muted-foreground shrink-0'>
                                {i + 1}
                            </span>
                            <div className='relative w-10 h-10 shrink-0 rounded overflow-hidden bg-muted'>
                                {track.track_album_cover && (
                                    <Image
                                        src={track.track_album_cover}
                                        alt={track.track_name}
                                        fill
                                        className='object-cover'
                                        sizes='40px'
                                    />
                                )}
                            </div>
                            <div className='flex-1 min-w-0'>
                                <p className='text-sm font-medium break-words leading-snug'>
                                    {track.track_name}
                                </p>
                                <p className='text-xs text-muted-foreground mt-0.5'>
                                    {track.artist_name}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Back to top */}
            {showBackToTop && (
                <button
                    onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                    className='fixed bottom-6 right-6 z-40 flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground shadow-lg transition-colors'>
                    <ArrowUp className='w-3.5 h-3.5' />
                    Top
                </button>
            )}

            {/* Delete dialog */}
            <Dialog.Root
                open={deleteOpen}
                onOpenChange={setDeleteOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
                    <Dialog.Content className='fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'>
                        <VisuallyHidden.Root>
                            <Dialog.Title />
                        </VisuallyHidden.Root>
                        <h2 className='text-lg font-semibold mb-1'>
                            {isOwner
                                ? "Delete playlist?"
                                : "Unfollow playlist?"}
                        </h2>
                        <p className='text-sm text-muted-foreground mb-6'>
                            {isOwner
                                ? `"${playlist.name}" will be permanently deleted from your Spotify account.`
                                : `You will stop following "${playlist.name}".`}
                        </p>
                        <div className='flex justify-end gap-2'>
                            <Dialog.Close asChild>
                                <Button variant='outline'>Cancel</Button>
                            </Dialog.Close>
                            <Button
                                variant='destructive'
                                onClick={handleDelete}
                                disabled={deleting}>
                                {deleting ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : isOwner ? (
                                    "Delete"
                                ) : (
                                    "Unfollow"
                                )}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
