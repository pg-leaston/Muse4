"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Music2,
  Pause,
  Pencil,
  Play,
  Shuffle,
  Trash2,
} from "lucide-react";

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
import { TopPlayedPanel } from "@/components/music/top-played-panel";
import { useAudioPlayer } from "@/contexts/audio-player-context";
import { formatTime } from "@/lib/format-time";
import { deleteSong, listSongs, type LocalSong } from "@/lib/music-library/idb";
import {
  formatLastPlayed,
  formatPlayCount,
  formatPlayLogTooltip,
  PLAY_RECORDED_EVENT,
  type PlayRecordedDetail,
} from "@/lib/music-library/play-history";
import { filterPlayableTracks } from "@/lib/music-library/playable";
import {
  fetchLibraryScan,
  importLibraryFromSongsFolder,
} from "@/lib/music-library/import-from-folder";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

type PlaylistOption = { id: string; label: string };

const ALL_PLAYLIST: PlaylistOption = { id: "all", label: "All Songs" };

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

function matchesPlaylist(song: LocalSong, playlistId: string) {
  if (playlistId === "all") return true;
  return song.playlistId === playlistId;
}

function getAlbumLabel(song: LocalSong) {
  const albumName = song.album.trim() || "Unknown album";
  return song.releaseYear ? `${albumName} (${song.releaseYear})` : albumName;
}

function buildPlaylistOptions(songs: LocalSong[]): PlaylistOption[] {
  const ids = new Set<string>();
  for (const song of songs) {
    if (song.playlistId.trim()) ids.add(song.playlistId);
  }
  const fromLibrary = Array.from(ids)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((id) => ({ id, label: id }));
  return [ALL_PLAYLIST, ...fromLibrary];
}

export function LibraryPageClient() {
  const [songs, setSongs] = useState<LocalSong[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [playlist, setPlaylist] = useState("all");
  const [folderPlaylists, setFolderPlaylists] = useState<PlaylistOption[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
    currentTitle: string;
  } | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const {
    currentSong,
    isPlaying,
    isShuffle,
    playQueue,
    startShuffle,
    removeSongFromPlayer,
    togglePlay,
  } = useAudioPlayer();

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

  useEffect(() => {
    const onPlayRecorded = (event: Event) => {
      const { songId, playCount, lastPlayedAt, playedAtLog } = (
        event as CustomEvent<PlayRecordedDetail>
      ).detail;
      setSongs((prev) =>
        prev.map((song) =>
          song.id === songId ?
            { ...song, playCount, lastPlayedAt, playedAtLog }
          : song,
        ),
      );
    };
    window.addEventListener(PLAY_RECORDED_EVENT, onPlayRecorded);
    return () =>
      window.removeEventListener(PLAY_RECORDED_EVENT, onPlayRecorded);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLibraryScan()
      .then((scan) => {
        if (cancelled) return;
        setFolderPlaylists(
          scan.playlists.map((p) => ({ id: p.id, label: p.label })),
        );
      })
      .catch(() => {
        if (!cancelled) setFolderPlaylists([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const playlistOptions = useMemo(() => {
    const merged = new Map<string, PlaylistOption>();
    merged.set(ALL_PLAYLIST.id, ALL_PLAYLIST);
    for (const item of buildPlaylistOptions(songs)) {
      if (item.id !== "all") merged.set(item.id, item);
    }
    for (const item of folderPlaylists) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
    return Array.from(merged.values());
  }, [songs, folderPlaylists]);

  const deleteTarget = useMemo(
    () => songs.find((s) => s.id === deleteId),
    [songs, deleteId],
  );

  const playableSongs = useMemo(
    () => filterPlayableTracks(songs),
    [songs],
  );

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return playableSongs.filter((song) => {
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
  }, [playlist, search, playableSongs]);

  const playlistCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of playlistOptions) {
      counts[item.id] = playableSongs.filter((song) =>
        matchesPlaylist(song, item.id),
      ).length;
    }
    return counts;
  }, [playableSongs, playlistOptions]);

  async function handleImportFromSongsFolder() {
    setImportMessage(null);
    let scan;
    try {
      scan = await fetchLibraryScan();
    } catch (err) {
      setImportMessage(
        err instanceof Error ? err.message : "Could not read Songs folder.",
      );
      return;
    }

    const total = scan.songs.length;
    if (total === 0) {
      setImportMessage("No songs found in the Songs folder.");
      return;
    }

    const ok = window.confirm(
      `Import ${total} tracks from Songs/ into your browser library? This may take several minutes.`,
    );
    if (!ok) return;

    setImporting(true);
    setImportProgress({ done: 0, total, currentTitle: "" });

    try {
      const { imported, failed, skipped } =
        await importLibraryFromSongsFolder({
          onProgress: setImportProgress,
        });
      await refresh();
      const skipNote =
        skipped > 0 ? ` ${skipped} skipped (0:00 duration).` : "";
      setImportMessage(
        failed > 0 ?
          `Imported ${imported} tracks (${failed} failed).${skipNote} Playlists match subfolders in Songs/.`
        : `Imported ${imported} tracks.${skipNote} Playlists match subfolders in Songs/.`,
      );
    } catch (err) {
      setImportMessage(
        err instanceof Error ? err.message : "Import failed.",
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    removeSongFromPlayer(deleteId);
    await deleteSong(deleteId);
    setDeleteId(null);
    await refresh();
  }

  function playSongFromLibrary(target: LocalSong, pool: LocalSong[] = filteredSongs) {
    if (currentSong?.id === target.id) {
      togglePlay();
      return;
    }
    const idx = pool.findIndex((s) => s.id === target.id);
    if (idx < 0) return;
    playQueue(pool, idx);
  }

  function handlePlaySong(index: number) {
    const target = filteredSongs[index];
    if (!target) return;
    playSongFromLibrary(target);
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 border-white/20 bg-white/8 text-white hover:bg-white/14",
                isShuffle && "border-violet-300/40 bg-violet-500/20",
              )}
              disabled={importing || filteredSongs.length === 0}
              onClick={() => void startShuffle(filteredSongs)}
            >
              <Shuffle className="size-4" />
              Shuffle
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 border-white/20 bg-white/8 text-white hover:bg-white/14"
              disabled={importing}
              onClick={() => void handleImportFromSongsFolder()}
            >
              {importing ?
                <>
                  <Loader2 className="animate-spin" />
                  Importing…
                </>
              : "Import Songs folder"}
            </Button>
            <Button
              type="button"
              className="h-9 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
              disabled={importing}
              onClick={() => {
                setFormMode("create");
                setEditId(null);
                setFormOpen(true);
              }}
            >
              Add Track
            </Button>
          </div>
        </header>

        {importProgress ?
          <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white/80">
            <p className="flex items-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              Importing {importProgress.done} / {importProgress.total}
              {importProgress.currentTitle ?
                ` — ${importProgress.currentTitle}`
              : null}
            </p>
          </div>
        : null}

        {importMessage ?
          <p className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white/78">
            {importMessage}
          </p>
        : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
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
                {playlistOptions.find((item) => item.id === playlist)?.label ??
                  "All Songs"}
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

                              <div
                                className="min-w-0"
                                title={formatPlayLogTooltip(song.playedAtLog)}
                              >
                                <p className="truncate text-[15px] font-medium text-white">
                                  {song.title}
                                </p>
                                <p className="truncate text-xs text-white/52">
                                  {formatTime(song.durationSeconds ?? 0)}
                                  <span className="text-white/38"> · </span>
                                  {formatPlayCount(song.playCount)}
                                </p>
                                {song.lastPlayedAt ?
                                  <p className="truncate text-[11px] text-white/40">
                                    Last {formatLastPlayed(song.lastPlayedAt)}
                                  </p>
                                : null}
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

          <div className="flex flex-col gap-6">
            <TopPlayedPanel
              songs={playableSongs}
              currentSongId={currentSong?.id ?? null}
              onPlaySong={(song) => playSongFromLibrary(song, playableSongs)}
            />

            <aside className="rounded-[30px] border border-white/10 bg-black/15 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[2rem] font-semibold text-white">Playlists</h2>
              <div className="rounded-md border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold tracking-[0.2em] text-white/72 uppercase">
                {filteredSongs.length}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {playlistOptions.map((item) => {
                const selected = playlist === item.id;
                const count = playlistCounts[item.id] ?? 0;

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
                    <span className="truncate">{item.label}</span>
                    <span className="ml-2 shrink-0 text-xs font-semibold tracking-[0.16em] uppercase text-white/55">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-6 text-xs leading-5 text-white/52">
              Each subfolder in <span className="text-white/70">Songs/</span> is
              a playlist. Use Import Songs folder to load mp3, cover art, and
              lyrics from your on-disk library.
            </p>
            </aside>
          </div>
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
