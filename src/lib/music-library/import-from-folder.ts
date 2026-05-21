"use client";

import {
  readAudioDurationFromBlob,
  saveSong,
  type LocalSong,
} from "@/lib/music-library/idb";
import { isPlayableTrack } from "@/lib/music-library/playable";

export type ScannedSongManifest = {
  id: string;
  playlistId: string;
  folderName: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  hasLyrics: boolean;
  audioRelativePath: string;
  artworkRelativePath: string | null;
  lyricsRelativePath: string | null;
};

export type LibraryScanResponse = {
  root: string;
  playlists: { id: string; label: string; songCount: number }[];
  songs: ScannedSongManifest[];
  error?: string;
};

export type ImportProgress = {
  done: number;
  total: number;
  currentTitle: string;
};

async function fetchFile(path: string): Promise<Blob> {
  const res = await fetch(`/api/library/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return res.blob();
}

async function fetchLyrics(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const res = await fetch(`/api/library/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function fetchLibraryScan(): Promise<LibraryScanResponse> {
  const res = await fetch("/api/library/scan");
  const data = (await res.json()) as LibraryScanResponse;
  if (!res.ok) {
    throw new Error(data.error ?? "Could not scan Songs folder.");
  }
  return data;
}

export async function importSongManifest(
  manifest: ScannedSongManifest,
): Promise<LocalSong> {
  const audioBlob = await fetchFile(manifest.audioRelativePath);
  const filename =
    manifest.audioRelativePath.split("/").pop() ?? "track.mp3";

  let artworkBlob: Blob | null = null;
  if (manifest.artworkRelativePath) {
    try {
      artworkBlob = await fetchFile(manifest.artworkRelativePath);
    } catch {
      artworkBlob = null;
    }
  }

  const lyrics =
    manifest.hasLyrics ?
      await fetchLyrics(manifest.lyricsRelativePath)
    : null;

  const durationSeconds = await readAudioDurationFromBlob(audioBlob, filename);

  return {
    id: manifest.id,
    title: manifest.title,
    artist: manifest.artist,
    album: manifest.album,
    releaseYear: manifest.releaseYear,
    playlistId: manifest.playlistId,
    lyrics,
    sourcePath: manifest.audioRelativePath,
    audioBlob,
    artworkBlob,
    durationSeconds,
    playCount: 0,
    lastPlayedAt: null,
    playedAtLog: [],
    createdAt: Date.now(),
  };
}

export async function importLibraryFromSongsFolder(options: {
  playlistId?: string;
  onProgress?: (progress: ImportProgress) => void;
  signal?: AbortSignal;
}): Promise<{ imported: number; failed: number; skipped: number }> {
  const scan = await fetchLibraryScan();
  let targets = scan.songs;
  if (options.playlistId) {
    targets = targets.filter((s) => s.playlistId === options.playlistId);
  }

  const total = targets.length;
  let imported = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < targets.length; i++) {
    if (options.signal?.aborted) break;

    const manifest = targets[i];
    options.onProgress?.({
      done: i,
      total,
      currentTitle: manifest.title,
    });

    try {
      const song = await importSongManifest(manifest);
      if (!isPlayableTrack(song)) {
        skipped += 1;
        continue;
      }
      await saveSong(song);
      imported += 1;
    } catch {
      failed += 1;
    }
  }

  options.onProgress?.({
    done: total,
    total,
    currentTitle: "",
  });

  return { imported, failed, skipped };
}
