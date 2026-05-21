import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseInformationFile } from "@/lib/songs-folder/parse-information";

export type ScannedPlaylist = {
  id: string;
  label: string;
  songCount: number;
};

export type ScannedSong = {
  id: string;
  playlistId: string;
  folderName: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  lyrics: string | null;
  audioRelativePath: string;
  artworkRelativePath: string | null;
  lyricsRelativePath: string | null;
};

export type SongsLibraryScan = {
  root: string;
  playlists: ScannedPlaylist[];
  songs: ScannedSong[];
};

function isAudioFile(name: string): boolean {
  return /\.(mp3|m4a|flac|wav|ogg)$/i.test(name);
}

function isImageFile(name: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function makeSongId(playlistId: string, folderName: string): string {
  return `folder:${encodeURIComponent(playlistId)}:${encodeURIComponent(folderName)}`;
}

async function scanSongFolder(
  playlistId: string,
  playlistPath: string,
  folderName: string,
): Promise<ScannedSong | null> {
  const songPath = join(playlistPath, folderName);
  let files: string[];
  try {
    files = await readdir(songPath);
  } catch {
    return null;
  }

  const audioFile = files.find(isAudioFile);
  if (!audioFile) return null;

  const infoFile =
    files.find((f) => f.toLowerCase() === `${folderName.toLowerCase()}-information.txt`) ??
    files.find((f) => f.endsWith("-information.txt"));

  const lyricsFile = files.find(
    (f) =>
      f.toLowerCase().endsWith(".txt") &&
      !f.toLowerCase().endsWith("-information.txt"),
  );

  const artworkFile =
    files.find((f) => f.toLowerCase() === `${folderName.toLowerCase()}.png`) ??
    files.find(isImageFile);

  let meta = {
    title: folderName,
    artist: "",
    album: "",
    releaseYear: null as number | null,
    genre: "",
    explicit: false,
  };

  if (infoFile) {
    try {
      const raw = await readFile(join(songPath, infoFile), "utf8");
      const parsed = parseInformationFile(raw);
      meta = { ...meta, ...parsed };
    } catch {
      // use folder defaults
    }
  }

  let lyrics: string | null = null;
  if (lyricsFile) {
    try {
      lyrics = await readFile(join(songPath, lyricsFile), "utf8");
    } catch {
      lyrics = null;
    }
  }

  const audioRelativePath = join(playlistId, folderName, audioFile).replace(/\\/g, "/");
  const artworkRelativePath =
    artworkFile ?
      join(playlistId, folderName, artworkFile).replace(/\\/g, "/")
    : null;
  const lyricsRelativePath =
    lyricsFile ?
      join(playlistId, folderName, lyricsFile).replace(/\\/g, "/")
    : null;

  return {
    id: makeSongId(playlistId, folderName),
    playlistId,
    folderName,
    title: meta.title || folderName,
    artist: meta.artist,
    album: meta.album,
    releaseYear: meta.releaseYear,
    lyrics,
    audioRelativePath,
    artworkRelativePath,
    lyricsRelativePath,
  };
}

export async function scanSongsLibrary(root: string): Promise<SongsLibraryScan> {
  const playlists: ScannedPlaylist[] = [];
  const songs: ScannedSong[] = [];

  let playlistEntries: { name: string; isDirectory: () => boolean }[];
  try {
    playlistEntries = await readdir(root, { withFileTypes: true });
  } catch {
    return { root, playlists: [], songs: [] };
  }

  for (const entry of playlistEntries) {
    if (!entry.isDirectory()) continue;
    const playlistId = entry.name;
    const playlistPath = join(root, playlistId);

    let songDirs: { name: string; isDirectory: () => boolean }[];
    try {
      songDirs = await readdir(playlistPath, { withFileTypes: true });
    } catch {
      continue;
    }

    let count = 0;
    for (const songDir of songDirs) {
      if (!songDir.isDirectory()) continue;
      const scanned = await scanSongFolder(
        playlistId,
        playlistPath,
        songDir.name,
      );
      if (!scanned) continue;
      songs.push(scanned);
      count += 1;
    }

    if (count > 0) {
      playlists.push({ id: playlistId, label: playlistId, songCount: count });
    }
  }

  playlists.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return { root, playlists, songs };
}

export function resolveSongsFilePath(
  root: string,
  relativePath: string,
): string | null {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return null;
  }
  return join(root, normalized);
}
