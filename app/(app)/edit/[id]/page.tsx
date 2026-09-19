"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Music, Search, X, ArrowUp } from "lucide-react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Check } from "lucide-react";
import type { SpotifyTrack } from "@/types";

export default function EditPlaylistPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [error, setError] = useState("");
    const [filterQuery, setFilterQuery] = useState("");
    const [showBackToTop, setShowBackToTop] = useState(false);

    const topRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch(`/api/playlist/${id}`)
            .then(r => r.json())
            .then(data => {
                setName(data.playlist?.name ?? "");
                setDescription(data.playlist?.description ?? "");
                setTracks(data.tracks ?? []);
            })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        const handleScroll = () => setShowBackToTop(window.scrollY > 400);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const filteredTracks = filterQuery.trim()
        ? tracks.filter(
              t =>
                  t.track_name
                      .toLowerCase()
                      .includes(filterQuery.toLowerCase()) ||
                  t.artist_name
                      .toLowerCase()
                      .includes(filterQuery.toLowerCase()),
          )
        : tracks;

    function toggleTrack(trackId: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) {
                next.delete(trackId);
            } else {
                next.add(trackId);
            }
            return next;
        });
    }

    function toggleAll(checked: boolean) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            for (const t of filteredTracks) {
                if (checked) next.add(t.track_id);
                else next.delete(t.track_id);
            }
            return next;
        });
    }

    function scrollToTop() {
        topRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    async function handleSave() {
        if (!name.trim()) {
            setError("Playlist name is required.");
            setSaveOpen(false);
            return;
        }
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`/api/playlist/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description,
                    removeTrackIds: [...selectedIds],
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                const d = text ? JSON.parse(text) : {};
                setError(d.error ?? "Save failed.");
                return;
            }
            router.push(`/playlist/${id}`);
            router.refresh();
        } catch {
            setError("Something went wrong.");
        } finally {
            setSaving(false);
            setSaveOpen(false);
        }
    }

    if (loading)
        return (
            <div className='flex justify-center items-center py-32'>
                <Loader2 className='w-6 h-6 animate-spin text-muted-foreground' />
            </div>
        );

    return (
        <div
            className='max-w-2xl mx-auto space-y-6 pb-24'
            ref={topRef}>
            {/* Sticky header with Cancel / Save */}
            <div className='sticky top-16 z-30 -mx-4 px-4 py-3 bg-background/90 backdrop-blur-sm border-b border-border flex items-center justify-between gap-3'>
                <div className='flex items-center gap-2 min-w-0'>
                    <Button
                        asChild
                        variant='ghost'
                        size='icon'
                        className='shrink-0'>
                        <Link href={`/playlist/${id}`}>
                            <ArrowLeft className='w-4 h-4' />
                        </Link>
                    </Button>
                    <h1 className='text-lg font-bold tracking-tight truncate'>
                        Edit Playlist
                    </h1>
                </div>
                <div className='flex gap-2 shrink-0'>
                    <Button
                        asChild
                        variant='outline'
                        size='sm'>
                        <Link href={`/playlist/${id}`}>Cancel</Link>
                    </Button>
                    <Button
                        size='sm'
                        onClick={() => setSaveOpen(true)}
                        disabled={saving}>
                        {saving ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            <>
                                {selectedIds.size > 0 && (
                                    <span className='mr-1.5 bg-primary-foreground/20 text-primary-foreground rounded-full px-1.5 py-0.5 text-xs'>
                                        {selectedIds.size}
                                    </span>
                                )}
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Playlist details */}
            <Card className='border-border/50'>
                <CardContent className='pt-6 space-y-4'>
                    <div className='space-y-1.5'>
                        <label
                            htmlFor='name'
                            className='text-sm font-medium'>
                            Name *
                        </label>
                        <input
                            id='name'
                            type='text'
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoComplete='off'
                            className='flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        />
                    </div>
                    <div className='space-y-1.5'>
                        <label
                            htmlFor='desc'
                            className='text-sm font-medium'>
                            Description
                        </label>
                        <textarea
                            id='desc'
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className='flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none'
                        />
                    </div>
                </CardContent>
            </Card>

            {error && <p className='text-sm text-destructive'>{error}</p>}

            {/* Track list */}
            {tracks.length > 0 && (
                <div className='space-y-3'>
                    {/* Search filter */}
                    <div className='relative'>
                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none' />
                        <input
                            type='text'
                            value={filterQuery}
                            onChange={e => setFilterQuery(e.target.value)}
                            placeholder='Filter by song or artist…'
                            className='search-field flex h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        />
                        {filterQuery && (
                            <button
                                onClick={() => setFilterQuery("")}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'>
                                <X className='w-4 h-4' />
                            </button>
                        )}
                    </div>

                    {/* Select all / count */}
                    <div className='flex items-center justify-between px-1'>
                        <p className='text-sm font-medium text-muted-foreground'>
                            {selectedIds.size > 0
                                ? `${selectedIds.size} of ${tracks.length} selected for removal`
                                : filterQuery
                                  ? `${filteredTracks.length} result${filteredTracks.length !== 1 ? "s" : ""}`
                                  : `${tracks.length} track${tracks.length !== 1 ? "s" : ""}`}
                        </p>
                        {filteredTracks.length > 0 && (
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                <Checkbox.Root
                                    id='selectAll'
                                    checked={
                                        filteredTracks.every(t =>
                                            selectedIds.has(t.track_id),
                                        )
                                            ? true
                                            : filteredTracks.some(t =>
                                                    selectedIds.has(
                                                        t.track_id,
                                                    ),
                                                )
                                              ? "indeterminate"
                                              : false
                                    }
                                    onCheckedChange={v => toggleAll(Boolean(v))}
                                    className='h-4 w-4 rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground flex items-center justify-center'>
                                    <Checkbox.Indicator>
                                        <Check className='h-3 w-3' />
                                    </Checkbox.Indicator>
                                </Checkbox.Root>
                                <label
                                    htmlFor='selectAll'
                                    className='cursor-pointer select-none'>
                                    {filterQuery ? "All results" : "All"}
                                </label>
                            </div>
                        )}
                    </div>

                    <div className='h-px bg-border' />

                    {/* Track rows */}
                    {filteredTracks.length === 0 ? (
                        <p className='text-sm text-muted-foreground text-center py-8'>
                            No tracks match &quot;{filterQuery}&quot;
                        </p>
                    ) : (
                        <div className='space-y-0.5'>
                            {filteredTracks.map((track, i) => {
                                const checked = selectedIds.has(track.track_id);
                                return (
                                    <div
                                        key={`${track.track_id}-${i}`}
                                        onClick={() =>
                                            toggleTrack(track.track_id)
                                        }
                                        className={`flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors ${
                                            checked
                                                ? "bg-destructive/10 hover:bg-destructive/15"
                                                : "hover:bg-muted/40"
                                        }`}>
                                        <Checkbox.Root
                                            checked={checked}
                                            onCheckedChange={() =>
                                                toggleTrack(track.track_id)
                                            }
                                            onClick={e => e.stopPropagation()}
                                            className='h-4 w-4 rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex items-center justify-center shrink-0'>
                                            <Checkbox.Indicator>
                                                <Check className='h-3 w-3' />
                                            </Checkbox.Indicator>
                                        </Checkbox.Root>

                                        <div className='relative w-10 h-10 shrink-0 rounded overflow-hidden bg-muted'>
                                            {track.track_album_cover && (
                                                <Image
                                                    src={
                                                        track.track_album_cover
                                                    }
                                                    alt={track.track_name}
                                                    fill
                                                    className='object-cover'
                                                    sizes='40px'
                                                />
                                            )}
                                        </div>

                                        {/* Full-width track info — no truncation cutoff on mobile */}
                                        <div className='flex-1 min-w-0'>
                                            <p className='text-sm font-medium break-words leading-snug'>
                                                {track.track_name}
                                            </p>
                                            <p className='text-xs text-muted-foreground mt-0.5'>
                                                {track.artist_name}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {tracks.length === 0 && (
                <div className='flex flex-col items-center py-12 gap-2 text-center'>
                    <Music className='w-8 h-8 text-muted-foreground' />
                    <p className='text-sm text-muted-foreground'>
                        No tracks yet.
                    </p>
                </div>
            )}

            {/* Back to top */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className='fixed bottom-6 right-6 z-40 flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground shadow-lg transition-colors'>
                    <ArrowUp className='w-3.5 h-3.5' />
                    Top
                </button>
            )}

            {/* Save confirmation dialog */}
            <Dialog.Root
                open={saveOpen}
                onOpenChange={setSaveOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
                    <Dialog.Content className='fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'>
                        <VisuallyHidden.Root>
                            <Dialog.Title />
                        </VisuallyHidden.Root>
                        <h2 className='text-lg font-semibold mb-1'>
                            Save changes?
                        </h2>
                        <p className='text-sm text-muted-foreground mb-6'>
                            {selectedIds.size > 0
                                ? `This will update the playlist details and remove ${selectedIds.size} track${selectedIds.size > 1 ? "s" : ""}.`
                                : "This will update the playlist details."}
                        </p>
                        <div className='flex justify-end gap-2'>
                            <Dialog.Close asChild>
                                <Button variant='outline'>Cancel</Button>
                            </Dialog.Close>
                            <Button
                                onClick={handleSave}
                                disabled={saving}>
                                {saving ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
