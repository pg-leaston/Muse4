"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Music2, Pause, Pencil, Play, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SongFormDialog } from "@/components/music/song-form-dialog";
import { useAudioPlayer } from "@/contexts/audio-player-context";
import { formatTime } from "@/lib/format-time";
import { deleteSong, listSongs, type LocalSong } from "@/lib/music-library/idb";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const PLAYLISTS = [
  { id: "all", label: "All Songs" },
  { id: "november", label: "November" },
  { id: "december", label: "December" },
  { id: "autumn", label: "Autumn" },
  { id: "winter", label: "Winter" },
  { id: "spring", label: "Spring" },
  { id: "summer", label: "Summer" },
] as const;

type PlaylistFilter = (typeof PLAYLISTS)[number]["id"];

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

function ArtworkThumb({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="absolute inset-0 block size-full object-cover"
      draggable={false}
    />
  );
}

function getSeason(date: Date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function matchesPlaylist(song: LocalSong, playlist: PlaylistFilter) {
  if (playlist === "all") return true;
  const createdAt = new Date(song.createdAt);
  return (
    monthFormatter.format(createdAt).toLowerCase() === playlist ||
    getSeason(createdAt) === playlist
  );
}

function getAlbumLabel(song: LocalSong) {
  const createdAt = new Date(song.createdAt);
  const albumName = song.album.trim() || `${monthFormatter.format(createdAt)} Sessions`;
  return song.releaseYear ? `${albumName} (${song.releaseYear})` : albumName;
}

export function LibraryPageClient() {
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playlist, setPlaylist] = useState<PlaylistFilter>("all");

  const { currentSong, isPlaying, playQueue, removeSongFromPlayer, togglePlay } =
    useAudioPlayer();

  const refresh = useCallback(async () => {
    setSongs(await listSongs());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listSongs().then((rows) => {
      if (!cancelled) setSongs(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteTarget = useMemo(
    () => songs.find((s) => s.id === deleteId),
    [songs, deleteId],
  );

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return songs.filter((song) => {
      if (!matchesPlaylist(song, playlist)) return false;
      if (!query) return true;

      const haystack = [
        song.title,
        song.artist || "unknown artist",
        getAlbumLabel(song),
        song.releaseYear?.toString() ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [playlist, search, songs]);

  const playlistCounts = useMemo(() => {
    return PLAYLISTS.reduce(
      (acc, item) => {
        acc[item.id] = songs.filter((song) => matchesPlaylist(song, item.id)).length;
        return acc;
      },
      {} as Record<PlaylistFilter, number>,
    );
  }, [songs]);

  async function confirmDelete() {
    if (!deleteId) return;
    removeSongFromPlayer(deleteId);
    await deleteSong(deleteId);
    setDeleteId(null);
    await refresh();
  }

  function handlePlaySong(index: number) {
    const target = filteredSongs[index];
    if (!target) return;

    if (currentSong?.id === target.id) {
      togglePlay();
      return;
    }

    playQueue(filteredSongs, index);
  }

  function handleRowDoubleClick(index: number) {
    const target = filteredSongs[index];
    if (!target) return;

    if (currentSong?.id === target.id) {
      if (!isPlaying) togglePlay();
      return;
    }

    playQueue(filteredSongs, index);
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,_rgba(98,34,182,0.42),_transparent_24%),radial-gradient(circle_at_80%_14%,_rgba(67,21,145,0.28),_transparent_24%),radial-gradient(circle_at_50%_55%,_rgba(120,34,204,0.14),_transparent_30%),linear-gradient(180deg,_#0b0115_0%,_#06000d_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-white">
              Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              Search your local tracks, queue them into the player, and keep the
              retro Muse layout from the reference screen.
            </p>
          </div>

          <Button
            type="button"
            className="h-9 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
            onClick={() => {
              setFormMode("create");
              setEditId(null);
              setFormOpen(true);
            }}
          >
            Add Track
          </Button>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
          <section className="rounded-[34px] border border-white/10 bg-black/15 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="w-full max-w-xs">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                  className="h-9 rounded-md border-black/15 bg-white text-black placeholder:text-black/45"
                />
              </div>

              <div className="rounded-md border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold tracking-[0.22em] text-white/78 uppercase">
                {PLAYLISTS.find((item) => item.id === playlist)?.label}
              </div>
            </div>

            {!isSupabaseConfigured() ?
              <p className="mt-4 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-xs text-white/68">
                Supabase env vars are not set yet. Tracks are currently stored
                in your browser until you wire the database and storage layer.
              </p>
            : null}

            <div className="mt-6">
              <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_132px] gap-4 border-b border-white/10 px-4 pb-3 text-[1.05rem] font-semibold text-white">
                <span>Title</span>
                <span>Artist</span>
                <span>Album</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="mt-2 max-h-[540px] overflow-y-auto pr-1">
                {filteredSongs.length === 0 ?
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-white/12 bg-white/4 px-6 text-center">
                    <Music2 className="size-8 text-white/55" />
                    <div>
                      <p className="text-lg font-semibold text-white">
                        No songs match this view
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        Import a track or switch playlists to populate the table.
                      </p>
                    </div>
                  </div>
                : <ul className="space-y-1.5">
                    {filteredSongs.map((song, index) => {
                      const isCurrent = currentSong?.id === song.id;
                      const albumLabel = getAlbumLabel(song);

                      return (
                        <li key={song.id}>
                          <div
                            className={cn(
                              "grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_132px] items-center gap-4 rounded-[22px] px-4 py-3 transition",
                              isCurrent ?
                                "bg-[linear-gradient(90deg,rgba(58,11,121,0.72),rgba(18,4,42,0.72))] shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
                              : "hover:bg-white/6",
                            )}
                            onDoubleClick={() => handleRowDoubleClick(index)}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/12 bg-black/30">
                                {song.artworkBlob ?
                                  <ArtworkThumb blob={song.artworkBlob} />
                                : <Music2 className="size-5 text-white/55" />}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-medium text-white">
                                  {song.title}
                                </p>
                                <p className="truncate text-xs text-white/52">
                                  {formatTime(song.durationSeconds ?? 0)}
                                </p>
                              </div>
                            </div>

                            <p className="truncate text-sm text-white/80">
                              {song.artist || "Unknown artist"}
                            </p>

                            <p className="truncate text-sm text-white/66">
                              {albumLabel}
                            </p>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="grid size-8 place-items-center rounded-full border border-white/18 bg-white/8 transition hover:bg-white/16"
                                aria-label={
                                  isCurrent && isPlaying ?
                                    `Pause ${song.title}`
                                  : `Play ${song.title}`
                                }
                                onClick={() => handlePlaySong(index)}
                              >
                                {isCurrent && isPlaying ?
                                  <Pause className="size-4 text-white" />
                                : <Play className="ml-0.5 size-4 fill-current text-white" />}
                              </button>

                              <button
                                type="button"
                                className="grid size-8 place-items-center rounded-full border border-white/14 bg-white/6 text-white/75 transition hover:bg-white/14 hover:text-white"
                                aria-label={`Edit ${song.title}`}
                                onClick={() => {
                                  setFormMode("edit");
                                  setEditId(song.id);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </button>

                              <button
                                type="button"
                                className="grid size-8 place-items-center rounded-full border border-red-300/20 bg-red-400/10 text-red-100 transition hover:bg-red-400/18"
                                aria-label={`Delete ${song.title}`}
                                onClick={() => setDeleteId(song.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                }
              </div>
            </div>
          </section>

          <aside className="rounded-[30px] border border-white/10 bg-black/15 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[2rem] font-semibold text-white">Playlists</h2>
              <div className="rounded-md border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold tracking-[0.2em] text-white/72 uppercase">
                {filteredSongs.length}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {PLAYLISTS.map((item) => {
                const selected = playlist === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2 text-left text-[1.1rem] transition",
                      selected ?
                        "bg-white/14 text-white shadow-[0_8px_20px_rgba(0,0,0,0.22)]"
                      : "text-white/78 hover:bg-white/8 hover:text-white",
                    )}
                    onClick={() => setPlaylist(item.id)}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs font-semibold tracking-[0.16em] uppercase text-white/55">
                      {playlistCounts[item.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-6 text-xs leading-5 text-white/52">
              Playlist buckets are generated from each track&apos;s import month
              and season. Album names and release years are now editable per
              song from the track dialog.
            </p>
          </aside>
        </div>

        <SongFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={formMode}
          songId={editId}
          onSaved={() => void refresh()}
        />

        <AlertDialog
          open={Boolean(deleteId)}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete track?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes{" "}
                <span className="text-foreground font-medium">
                  {deleteTarget?.title}
                </span>{" "}
                from this device&apos;s local library. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void confirmDelete()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
