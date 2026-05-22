import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { parseFile } from "music-metadata";
import type { SupabaseClient } from "@supabase/supabase-js";

import { songUuidFromSourceKey } from "@/lib/music-library/stable-song-id";
import {
  resolveSongsFilePath,
  type ScannedSong,
} from "@/lib/songs-folder/scan";
import {
  TRACK_ARTWORK_BUCKET,
  TRACKS_BUCKET,
} from "@/lib/supabase/storage-buckets";
import type { Database } from "@/types/database.types";

export type SyncSongResult = "imported" | "skipped" | "failed";

export type SyncSongOutcome = {
  sourceKey: string;
  title: string;
  result: SyncSongResult;
  error?: string;
};

function artworkContentType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

async function readDurationSeconds(audioPath: string): Promise<number | null> {
  try {
    const metadata = await parseFile(audioPath);
    const d = metadata.format.duration;
    return d != null && Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

export async function syncScannedSongToSupabase(options: {
  supabase: SupabaseClient<Database>;
  userId: string;
  songsRoot: string;
  song: ScannedSong;
  sortOrder: number;
}): Promise<SyncSongOutcome> {
  const { supabase, userId, songsRoot, song, sortOrder } = options;
  const base = { sourceKey: song.id, title: song.title };

  const audioAbs = resolveSongsFilePath(songsRoot, song.audioRelativePath);
  if (!audioAbs) {
    return { ...base, result: "failed", error: "Invalid audio path" };
  }

  const durationSeconds = await readDurationSeconds(audioAbs);
  if (durationSeconds == null) {
    return { ...base, result: "skipped", error: "0:00 or unreadable audio" };
  }

  const songId = songUuidFromSourceKey(song.id);
  const audioStoragePath = `${userId}/songs/${songId}/audio.mp3`;

  try {
    const audioBytes = await readFile(audioAbs);
    const { error: audioError } = await supabase.storage
      .from(TRACKS_BUCKET)
      .upload(audioStoragePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (audioError) {
      return { ...base, result: "failed", error: audioError.message };
    }

    let artworkStoragePath: string | null = null;
    if (song.artworkRelativePath) {
      const artAbs = resolveSongsFilePath(songsRoot, song.artworkRelativePath);
      if (artAbs) {
        const artName = song.artworkRelativePath.split("/").pop() ?? "cover.png";
        const ext = extname(artName) || ".png";
        artworkStoragePath = `${userId}/songs/${songId}/cover${ext}`;
        const artBytes = await readFile(artAbs);
        const { error: artError } = await supabase.storage
          .from(TRACK_ARTWORK_BUCKET)
          .upload(artworkStoragePath, artBytes, {
            contentType: artworkContentType(artName),
            upsert: true,
          });
        if (artError) {
          return { ...base, result: "failed", error: artError.message };
        }
      }
    }

    const now = new Date().toISOString();
    const row: Database["public"]["Tables"]["songs"]["Insert"] = {
      id: songId,
      user_id: userId,
      title: song.title,
      artist: song.artist,
      album: song.album,
      release_year: song.releaseYear,
      audio_storage_path: audioStoragePath,
      artwork_storage_path: artworkStoragePath,
      duration_seconds: durationSeconds,
      lyrics: song.lyrics?.trim() ? song.lyrics : null,
      playlist_id: song.playlistId,
      source_key: song.id,
      genre: song.genre,
      explicit: song.explicit,
      sort_order: sortOrder,
      updated_at: now,
    };

    const { error: dbError } = await supabase.from("songs").upsert(row, {
      onConflict: "id",
    });

    if (dbError) {
      return { ...base, result: "failed", error: dbError.message };
    }

    return { ...base, result: "imported" };
  } catch (err) {
    return {
      ...base,
      result: "failed",
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

export type SyncBatchSummary = {
  imported: number;
  skipped: number;
  failed: number;
  outcomes: SyncSongOutcome[];
};

export async function syncScannedSongsBatch(options: {
  supabase: SupabaseClient<Database>;
  userId: string;
  songsRoot: string;
  songs: ScannedSong[];
  startSortOrder?: number;
}): Promise<SyncBatchSummary> {
  const summary: SyncBatchSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
    outcomes: [],
  };

  let sortOrder = options.startSortOrder ?? 0;
  for (const song of options.songs) {
    const outcome = await syncScannedSongToSupabase({
      supabase: options.supabase,
      userId: options.userId,
      songsRoot: options.songsRoot,
      song,
      sortOrder,
    });
    summary.outcomes.push(outcome);
    if (outcome.result === "imported") {
      summary.imported += 1;
      sortOrder += 1;
    } else if (outcome.result === "skipped") {
      summary.skipped += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}
