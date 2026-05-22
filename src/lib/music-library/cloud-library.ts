"use client";

import {
  fromCloudSongDto,
  type CloudSongDto,
  type LibraryTrack,
} from "@/lib/music-library/library-track";
import {
  TRACK_ARTWORK_BUCKET,
  TRACKS_BUCKET,
  type MuseStorageBucket,
} from "@/lib/supabase/storage-buckets";

export async function fetchCloudLibrary(): Promise<LibraryTrack[]> {
  const res = await fetch("/api/library/cloud", {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json()) as {
    songs?: CloudSongDto[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Could not load cloud library.");
  }
  return (data.songs ?? []).map(fromCloudSongDto);
}

type SignItem = {
  key: string;
  bucket: MuseStorageBucket;
  path: string;
};

export async function attachSignedPlaybackUrls(
  tracks: LibraryTrack[],
): Promise<LibraryTrack[]> {
  const items: SignItem[] = [];
  for (const track of tracks) {
    if (track.source !== "cloud" || !track.audioStoragePath) continue;
    items.push({
      key: `${track.id}:audio`,
      bucket: TRACKS_BUCKET,
      path: track.audioStoragePath,
    });
    if (track.artworkStoragePath) {
      items.push({
        key: `${track.id}:art`,
        bucket: TRACK_ARTWORK_BUCKET,
        path: track.artworkStoragePath,
      });
    }
  }
  if (items.length === 0) return tracks;

  const urls: Record<string, string> = {};
  const chunkSize = 40;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const res = await fetch("/api/library/cloud/sign", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: chunk }),
    });
    const data = (await res.json()) as {
      urls?: Record<string, string>;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "Could not sign media URLs.");
    }
    Object.assign(urls, data.urls ?? {});
  }

  return tracks.map((track) => ({
    ...track,
    audioPlaybackUrl: urls[`${track.id}:audio`] ?? track.audioPlaybackUrl ?? null,
    artworkPlaybackUrl: urls[`${track.id}:art`] ?? track.artworkPlaybackUrl ?? null,
  }));
}

/** Sign artwork for library rows (batched). */
export async function attachSignedArtworkUrls(
  tracks: LibraryTrack[],
): Promise<LibraryTrack[]> {
  const items: SignItem[] = [];
  for (const track of tracks) {
    if (track.source !== "cloud" || !track.artworkStoragePath) continue;
    if (track.artworkPlaybackUrl) continue;
    items.push({
      key: track.id,
      bucket: TRACK_ARTWORK_BUCKET,
      path: track.artworkStoragePath,
    });
  }
  if (items.length === 0) return tracks;

  const urls: Record<string, string> = {};
  const chunkSize = 40;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const res = await fetch("/api/library/cloud/sign", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: chunk }),
    });
    const data = (await res.json()) as {
      urls?: Record<string, string>;
      error?: string;
    };
    if (!res.ok) continue;
    Object.assign(urls, data.urls ?? {});
  }

  return tracks.map((track) => ({
    ...track,
    artworkPlaybackUrl:
      urls[track.id] ?? track.artworkPlaybackUrl ?? null,
  }));
}
