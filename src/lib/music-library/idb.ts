"use client";

import {
  dispatchPlayRecorded,
  PLAY_LOG_MAX,
  type PlayRecordedDetail,
} from "@/lib/music-library/play-history";

const DB_NAME = "muse4-music";
const DB_VERSION = 3;
const STORE = "songs";

export type LocalSong = {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  playlistId: string;
  lyrics: string | null;
  sourcePath: string | null;
  audioBlob: Blob;
  artworkBlob: Blob | null;
  durationSeconds: number | null;
  playCount: number;
  lastPlayedAt: number | null;
  playedAtLog: number[];
  createdAt: number;
};

function normalizeSong(row: Partial<LocalSong>): LocalSong {
  const playedAtLog = Array.isArray(row.playedAtLog) ? row.playedAtLog.slice() : [];
  return {
    id: row.id ?? crypto.randomUUID(),
    title: row.title ?? "",
    artist: row.artist ?? "",
    album: row.album ?? "",
    releaseYear: row.releaseYear ?? null,
    playlistId: row.playlistId ?? "",
    lyrics: row.lyrics ?? null,
    sourcePath: row.sourcePath ?? null,
    audioBlob: row.audioBlob as Blob,
    artworkBlob: row.artworkBlob ?? null,
    durationSeconds: row.durationSeconds ?? null,
    playCount: row.playCount ?? 0,
    lastPlayedAt: row.lastPlayedAt ?? null,
    playedAtLog,
    createdAt: row.createdAt ?? Date.now(),
  };
}

function mergePlayHistory(
  incoming: LocalSong,
  existing: LocalSong | undefined,
): LocalSong {
  if (!existing) return incoming;
  const incomingCount = incoming.playCount ?? 0;
  const existingCount = existing.playCount ?? 0;
  if (incomingCount >= existingCount) return incoming;
  return {
    ...incoming,
    playCount: existingCount,
    lastPlayedAt: existing.lastPlayedAt ?? incoming.lastPlayedAt,
    playedAtLog:
      (existing.playedAtLog?.length ?? 0) >= (incoming.playedAtLog?.length ?? 0) ?
        existing.playedAtLog
      : incoming.playedAtLog,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function listSongs(): Promise<LocalSong[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as Partial<LocalSong>[])
        .map((row) => normalizeSong(row))
        .slice();
      rows.sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
  });
}

export async function getSong(id: string): Promise<LocalSong | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as Partial<LocalSong> | undefined;
      resolve(row ? normalizeSong(row) : undefined);
    };
  });
}

export async function saveSong(song: LocalSong): Promise<void> {
  const existing = await getSong(song.id);
  const merged = mergePlayHistory(normalizeSong(song), existing);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(merged);
  });
}

export async function recordSongPlay(
  songId: string,
): Promise<PlayRecordedDetail | undefined> {
  const song = await getSong(songId);
  if (!song) return undefined;

  const now = Date.now();
  const playedAtLog = [...song.playedAtLog, now].slice(-PLAY_LOG_MAX);
  const updated: LocalSong = {
    ...song,
    playCount: song.playCount + 1,
    lastPlayedAt: now,
    playedAtLog,
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(updated);
  });

  const detail: PlayRecordedDetail = {
    songId,
    playCount: updated.playCount,
    lastPlayedAt: now,
    playedAtLog,
  };
  dispatchPlayRecorded(detail);
  return detail;
}

export async function saveSongsBatch(songs: LocalSong[]): Promise<void> {
  const merged: LocalSong[] = [];
  for (const song of songs) {
    const existing = await getSong(song.id);
    merged.push(mergePlayHistory(normalizeSong(song), existing));
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    for (const song of merged) {
      store.put(song);
    }
  });
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
}

export async function readAudioDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    audio.src = url;
    audio.load();
    await new Promise<void>((resolve, reject) => {
      const onDone = () => {
        audio.removeEventListener("loadedmetadata", onDone);
        audio.removeEventListener("error", onErr);
        resolve();
      };
      const onErr = () => {
        audio.removeEventListener("loadedmetadata", onDone);
        audio.removeEventListener("error", onErr);
        reject(new Error("Could not read audio metadata"));
      };
      audio.addEventListener("loadedmetadata", onDone, { once: true });
      audio.addEventListener("error", onErr, { once: true });
    });
    const d = audio.duration;
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readAudioDurationFromBlob(
  blob: Blob,
  filename: string,
): Promise<number | null> {
  const type = blob.type || "audio/mpeg";
  return readAudioDuration(new File([blob], filename, { type }));
}
