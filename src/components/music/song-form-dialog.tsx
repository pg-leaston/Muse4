"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Music2,
  Search,
  Play,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocalSong } from "@/lib/music-library/idb";
import { getSong, readAudioDuration, saveSong } from "@/lib/music-library/idb";
import { formatTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";

type MusicMatch = {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  artworkUrl: string | null;
};

type YouTubeVideo = {
  id: string;
  title: string;
  url: string;
  channel: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

type AddTab = "upload" | "search";

type SongFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  songId?: string | null;
  onSaved: () => void;
};

async function fetchArtworkBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(
      `/api/music/artwork?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export function SongFormDialog({
  open,
  onOpenChange,
  mode,
  songId,
  onSaved,
}: SongFormDialogProps) {
  const [addTab, setAddTab] = useState<AddTab>("upload");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artFile, setArtFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchArtist, setSearchArtist] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchingSongs, setSearchingSongs] = useState(false);
  const [songResults, setSongResults] = useState<MusicMatch[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    null,
  );
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [fetchingAudio, setFetchingAudio] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const searchGenerationRef = useRef(0);
  const audioDownloadRef = useRef<Promise<File | null> | null>(null);

  function parseReleaseYear(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const year = Number(trimmed);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
      throw new Error("Release year must be a 4-digit year.");
    }

    return year;
  }

  const resetSearchTabState = useCallback(() => {
    searchGenerationRef.current += 1;
    audioDownloadRef.current = null;
    setSearchArtist("");
    setSearchTitle("");
    setSearchingSongs(false);
    setSongResults([]);
    setSelectedRecordingId(null);
    setLoadingSelection(false);
    setYoutubeVideos([]);
    setLoadingYoutube(false);
    setSelectedVideoUrl(null);
    setFetchingAudio(false);
    setAudioReady(false);
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setArtist("");
    setAlbum("");
    setReleaseYear("");
    setAudioFile(null);
    setArtFile(null);
    setAddTab("upload");
    resetSearchTabState();
  }, [resetSearchTabState]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setError(null);
      if (mode === "create") {
        resetForm();
        return;
      }
      if (!songId) return;
      void getSong(songId).then((row) => {
        if (cancelled || !row) return;
        setTitle(row.title);
        setArtist(row.artist);
        setAlbum(row.album);
        setReleaseYear(row.releaseYear?.toString() ?? "");
        setAudioFile(null);
        setArtFile(null);
        setAddTab("upload");
        resetSearchTabState();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, songId, resetForm, resetSearchTabState]);

  const startAudioDownload = useCallback((url: string) => {
    setFetchingAudio(true);
    setAudioReady(false);
    setAudioFile(null);

    const promise = (async (): Promise<File | null> => {
      try {
        const res = await fetch("/api/music/youtube/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Could not get audio from video.");
        }

        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const nameMatch = disposition.match(/filename="([^"]+)"/);
        const filename = nameMatch?.[1] ?? "track.mp3";

        return new File([blob], filename, {
          type: blob.type || "audio/mpeg",
        });
      } catch {
        return null;
      }
    })();

    audioDownloadRef.current = promise;

    void promise.then((file) => {
      if (file) {
        setAudioFile(file);
        setAudioReady(true);
      }
      setFetchingAudio(false);
    });
  }, []);

  const applyRecordingMetadata = useCallback(async (match: MusicMatch) => {
    setTitle(match.title);
    setArtist(match.artist);
    setAlbum(match.album);
    setReleaseYear(match.releaseYear?.toString() ?? "");

    if (match.artworkUrl) {
      const blob = await fetchArtworkBlob(match.artworkUrl);
      if (blob) {
        setArtFile(
          new File([blob], "cover.jpg", {
            type: blob.type || "image/jpeg",
          }),
        );
      }
    }
  }, []);

  const selectRecording = useCallback(
    async (recordingId: string) => {
      const generation = ++searchGenerationRef.current;
      setSelectedRecordingId(recordingId);
      setLoadingSelection(true);
      setLoadingYoutube(true);
      setYoutubeVideos([]);
      setSelectedVideoUrl(null);
      setAudioFile(null);
      setAudioReady(false);
      audioDownloadRef.current = null;
      setError(null);

      try {
        const recordingRes = await fetch(
          `/api/music/recording?id=${encodeURIComponent(recordingId)}`,
        );

        if (searchGenerationRef.current !== generation) return;

        const recordingData = (await recordingRes.json()) as {
          match?: MusicMatch;
          error?: string;
        };

        if (!recordingRes.ok || !recordingData.match) {
          throw new Error(
            recordingData.error ?? "Could not load track details.",
          );
        }

        await applyRecordingMetadata(recordingData.match);
        setLoadingSelection(false);

        const youtubeRes = await fetch(
          `/api/music/youtube/search?${new URLSearchParams({
            title: recordingData.match.title,
            artist: recordingData.match.artist,
            limit: "8",
          })}`,
        );

        if (searchGenerationRef.current !== generation) return;

        const youtubeData = (await youtubeRes.json()) as {
          videos?: YouTubeVideo[];
          error?: string;
        };

        if (youtubeRes.ok) {
          setYoutubeVideos(youtubeData.videos ?? []);
          if (!youtubeData.videos?.length && youtubeData.error) {
            setError(youtubeData.error);
          }
        } else {
          setYoutubeVideos([]);
          setError(youtubeData.error ?? "YouTube search failed.");
        }
      } catch (err) {
        if (searchGenerationRef.current !== generation) return;
        setError(err instanceof Error ? err.message : "Selection failed.");
      } finally {
        if (searchGenerationRef.current === generation) {
          setLoadingSelection(false);
          setLoadingYoutube(false);
        }
      }
    },
    [applyRecordingMetadata],
  );

  const selectYoutubeVideo = useCallback(
    (video: YouTubeVideo) => {
      setSelectedVideoUrl(video.url);
      startAudioDownload(video.url);
    },
    [startAudioDownload],
  );

  useEffect(() => {
    if (!open || mode !== "create" || addTab !== "search") return;

    const artist = searchArtist.trim();
    const title = searchTitle.trim();

    function clearSearchResults() {
      setSongResults([]);
      setSearchingSongs(false);
      setSelectedRecordingId(null);
      setYoutubeVideos([]);
      setSelectedVideoUrl(null);
    }

    if (!artist && !title) {
      clearSearchResults();
      return;
    }

    const hasBoth = Boolean(artist && title);
    if (!hasBoth && artist.length < 2 && title.length < 2) {
      return;
    }
    if (hasBoth && (artist.length < 1 || title.length < 1)) {
      return;
    }

    const generation = ++searchGenerationRef.current;
    const timer = window.setTimeout(() => {
      setSearchingSongs(true);
      setError(null);

      const params = new URLSearchParams({ limit: "8" });
      if (hasBoth) {
        params.set("artist", artist);
        params.set("title", title);
      } else if (title) {
        params.set("title", title);
      } else {
        params.set("artist", artist);
      }

      void fetch(`/api/music/search?${params}`)
        .then(async (res) => {
          if (searchGenerationRef.current !== generation) return;
          const data = (await res.json()) as {
            matches?: MusicMatch[];
            error?: string;
          };
          if (!res.ok) {
            throw new Error(data.error ?? "Search failed.");
          }
          setSongResults(data.matches ?? []);
        })
        .catch((err) => {
          if (searchGenerationRef.current !== generation) return;
          setError(err instanceof Error ? err.message : "Search failed.");
          setSongResults([]);
        })
        .finally(() => {
          if (searchGenerationRef.current === generation) {
            setSearchingSongs(false);
          }
        });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [searchArtist, searchTitle, open, mode, addTab]);

  async function ensureAudioFromVideo(): Promise<File> {
    if (audioFile) return audioFile;

    const pending = audioDownloadRef.current;
    if (pending) {
      const file = await pending;
      if (file) {
        setAudioFile(file);
        setAudioReady(true);
        return file;
      }
    }

    if (!selectedVideoUrl) {
      throw new Error("Pick a YouTube video for this track.");
    }

    throw new Error(
      fetchingAudio ?
        "Still preparing audio from the video. Wait a moment and try again."
      : "Could not get audio from the selected video.",
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let fileToSave = audioFile;
    if (mode === "create" && addTab === "search") {
      try {
        fileToSave = await ensureAudioFromVideo();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Audio not ready.");
        return;
      }
    } else if (mode === "create" && !fileToSave) {
      setError("Choose an audio file or search for a track.");
      return;
    }

    setBusy(true);
    try {
      const parsedReleaseYear = parseReleaseYear(releaseYear);

      if (mode === "create" && fileToSave) {
        const durationSeconds = await readAudioDuration(fileToSave);
        const song: LocalSong = {
          id: crypto.randomUUID(),
          title: title.trim() || fileToSave.name.replace(/\.[^/.]+$/, ""),
          artist: artist.trim(),
          album: album.trim(),
          releaseYear: parsedReleaseYear,
          playlistId: "",
          lyrics: null,
          sourcePath: null,
          audioBlob: fileToSave,
          artworkBlob: artFile,
          durationSeconds,
          playCount: 0,
          lastPlayedAt: null,
          playedAtLog: [],
          createdAt: Date.now(),
        };
        await saveSong(song);
      } else if (mode === "edit" && songId) {
        const existing = await getSong(songId);
        if (!existing) {
          setError("Song not found.");
          return;
        }
        const audioBlob = fileToSave ?? existing.audioBlob;
        const artworkBlob = artFile ?? existing.artworkBlob;
        let durationSeconds = existing.durationSeconds;
        if (fileToSave) {
          durationSeconds = await readAudioDuration(fileToSave);
        }
        await saveSong({
          ...existing,
          title: title.trim() || existing.title,
          artist: artist.trim(),
          album: album.trim(),
          releaseYear: parsedReleaseYear,
          audioBlob,
          artworkBlob,
          durationSeconds,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save song.");
    } finally {
      setBusy(false);
    }
  }

  const searchTabBusy =
    loadingSelection || loadingYoutube || (fetchingAudio && !audioReady);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="flex-col items-start justify-start">
          <DialogTitle>
            {mode === "create" ? "Add track" : "Edit track"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ?
              "Upload a file or search for a song, then pick a YouTube video for the audio."
            : "Update track details. Audio and cover art stay in your browser."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
            {mode === "create" ?
              <div className="flex flex-col gap-4">
                <div className="bg-muted/50 flex gap-1 rounded-lg p-1">
                  <Button
                    type="button"
                    variant={addTab === "upload" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setAddTab("upload");
                      setError(null);
                    }}
                  >
                    <Upload data-icon="inline-start" />
                    Upload file
                  </Button>
                  <Button
                    type="button"
                    variant={addTab === "search" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setAddTab("search");
                      setError(null);
                    }}
                  >
                    <Search data-icon="inline-start" />
                    Search
                  </Button>
                </div>

                {addTab === "upload" ?
                  <div className="grid gap-2">
                    <Label htmlFor="song-audio">Audio file</Label>
                    <Input
                      id="song-audio"
                      type="file"
                      accept="audio/*,.mp3,audio/mpeg"
                      className="cursor-pointer"
                      onChange={(e) =>
                        setAudioFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                : <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>Search MusicBrainz</Label>
                      <p className="text-muted-foreground text-xs">
                        Optional: fill in artist, song, or both for a tighter
                        match.
                      </p>
                      <div className="grid gap-2">
                        <Label htmlFor="search-artist" className="text-xs">
                          Artist
                        </Label>
                        <Input
                          id="search-artist"
                          value={searchArtist}
                          onChange={(e) => setSearchArtist(e.target.value)}
                          placeholder="e.g. Larry June"
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="search-title" className="text-xs">
                          Song
                        </Label>
                        <div className="relative">
                          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                          <Input
                            id="search-title"
                            value={searchTitle}
                            onChange={(e) => setSearchTitle(e.target.value)}
                            placeholder="e.g. The Good Kind"
                            className="pl-8"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>

                    {searchingSongs ?
                      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <Loader2 className="size-3.5 animate-spin" />
                        Searching MusicBrainz…
                      </p>
                    : null}

                    {songResults.length > 0 ?
                      <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Results
                        </p>
                        <div className="border-border flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1">
                          {songResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              className={cn(
                                "hover:bg-muted/80 flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                                selectedRecordingId === result.id &&
                                  "bg-muted ring-1 ring-border",
                              )}
                              onClick={() => void selectRecording(result.id)}
                            >
                              <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded">
                                {result.artworkUrl ?
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={result.artworkUrl}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                : <div className="text-muted-foreground flex size-full items-center justify-center">
                                    <Music2 className="size-4" />
                                  </div>
                                }
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {result.title}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {result.artist || "Unknown artist"}
                                  {result.album ?
                                    ` · ${result.album}`
                                  : null}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    : null}

                    {selectedRecordingId ?
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">
                          YouTube results
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Searched using the artist and song name. Best matches
                          show the track title in the video name.
                        </p>
                        {loadingYoutube ?
                          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                            <Loader2 className="size-3.5 animate-spin" />
                            Searching YouTube…
                          </p>
                        : null}
                        {!loadingYoutube &&
                        youtubeVideos.length === 0 &&
                        selectedRecordingId ?
                          <p className="text-muted-foreground text-sm">
                            No YouTube videos found for this track. Try another
                            MusicBrainz result or upload audio manually.
                          </p>
                        : null}
                        <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
                          {youtubeVideos.map((video) => (
                            <button
                              key={video.id}
                              type="button"
                              className={cn(
                                "hover:bg-muted/80 border-border flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                                selectedVideoUrl === video.url &&
                                  "bg-muted ring-1 ring-border",
                              )}
                              onClick={() => selectYoutubeVideo(video)}
                            >
                              <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md">
                                {video.thumbnailUrl ?
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={video.thumbnailUrl}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                : <div className="text-muted-foreground flex size-full items-center justify-center">
                                    <Play className="size-5" />
                                  </div>
                                }
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm leading-snug font-medium">
                                  {video.title}
                                </p>
                                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                  {video.channel || "YouTube"}
                                  {video.durationSeconds ?
                                    ` · ${formatTime(video.durationSeconds)}`
                                  : null}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                        {selectedVideoUrl ?
                          <p
                            className={cn(
                              "flex items-center gap-1.5 text-sm",
                              audioReady ?
                                "text-foreground"
                              : "text-muted-foreground",
                            )}
                          >
                            {fetchingAudio && !audioReady ?
                              <Loader2 className="size-3.5 shrink-0 animate-spin" />
                            : audioReady ?
                              <Check className="size-3.5 shrink-0" />
                            : null}
                            {fetchingAudio && !audioReady ?
                              "Preparing audio from video…"
                            : audioReady ?
                              "Audio ready — you can save"
                            : null}
                          </p>
                        : null}
                      </div>
                    : null}
                  </div>
                }
              </div>
            : <div className="grid gap-2">
                <Label htmlFor="song-audio-edit">Audio file (optional)</Label>
                <Input
                  id="song-audio-edit"
                  type="file"
                  accept="audio/*,.mp3,audio/mpeg"
                  className="cursor-pointer"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                />
              </div>
            }

            <div className="grid gap-2">
              <Label htmlFor="song-title">Title</Label>
              <Input
                id="song-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Track title"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="song-artist">Artist</Label>
              <Input
                id="song-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="song-album">Album</Label>
              <Input
                id="song-album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="song-release-year">Release year</Label>
              <Input
                id="song-release-year"
                type="number"
                inputMode="numeric"
                min={1000}
                max={9999}
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                placeholder="2024"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="song-art">Artwork (optional)</Label>
              <Input
                id="song-art"
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={(e) => setArtFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {error ?
              <p className="text-destructive text-sm">{error}</p>
            : null}
          </DialogBody>
          <div className="border-border flex justify-center gap-2 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                (addTab === "search" && mode === "create" && searchTabBusy && !audioReady)
              }
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
