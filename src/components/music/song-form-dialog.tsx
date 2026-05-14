"use client";

import { useEffect, useState } from "react";

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

type SongFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  songId?: string | null;
  onSaved: () => void;
};

export function SongFormDialog({
  open,
  onOpenChange,
  mode,
  songId,
  onSaved,
}: SongFormDialogProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artFile, setArtFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseReleaseYear(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const year = Number(trimmed);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
      throw new Error("Release year must be a 4-digit year.");
    }

    return year;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setError(null);
      if (mode === "create") {
        setTitle("");
        setArtist("");
        setAlbum("");
        setReleaseYear("");
        setAudioFile(null);
        setArtFile(null);
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
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, songId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "create" && !audioFile) {
      setError("Choose an MP3 (or other audio) file.");
      return;
    }
    setBusy(true);
    try {
      const parsedReleaseYear = parseReleaseYear(releaseYear);

      if (mode === "create" && audioFile) {
        const durationSeconds = await readAudioDuration(audioFile);
        const song: LocalSong = {
          id: crypto.randomUUID(),
          title: title.trim() || audioFile.name.replace(/\.[^/.]+$/, ""),
          artist: artist.trim(),
          album: album.trim(),
          releaseYear: parsedReleaseYear,
          audioBlob: audioFile,
          artworkBlob: artFile,
          durationSeconds,
          createdAt: Date.now(),
        };
        await saveSong(song);
      } else if (mode === "edit" && songId) {
        const existing = await getSong(songId);
        if (!existing) {
          setError("Song not found.");
          return;
        }
        const audioBlob = audioFile ?? existing.audioBlob;
        const artworkBlob = artFile ?? existing.artworkBlob;
        let durationSeconds = existing.durationSeconds;
        if (audioFile) {
          durationSeconds = await readAudioDuration(audioFile);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="flex-col items-start justify-start">
          <DialogTitle>
            {mode === "create" ? "Add track" : "Edit track"}
          </DialogTitle>
          <DialogDescription>
            Audio and cover art are stored locally in your browser until you
            connect Supabase Storage and swap the data layer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
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
              <Label htmlFor="song-audio">
                Audio file {mode === "edit" ? "(optional)" : ""}
              </Label>
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
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
