"use client";

const DB_NAME = "muse4-music";
const DB_VERSION = 1;
const STORE = "songs";

export type LocalSong = {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  audioBlob: Blob;
  artworkBlob: Blob | null;
  durationSeconds: number | null;
  createdAt: number;
};

function normalizeSong(row: Partial<LocalSong>): LocalSong {
  return {
    id: row.id ?? crypto.randomUUID(),
    title: row.title ?? "",
    artist: row.artist ?? "",
    album: row.album ?? "",
    releaseYear: row.releaseYear ?? null,
    audioBlob: row.audioBlob as Blob,
    artworkBlob: row.artworkBlob ?? null,
    durationSeconds: row.durationSeconds ?? null,
    createdAt: row.createdAt ?? Date.now(),
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
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(song);
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
