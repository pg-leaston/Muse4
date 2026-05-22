import type { LocalSong } from "@/lib/music-library/idb";

export type CloudSongDto = {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  playlistId: string;
  lyrics: string | null;
  durationSeconds: number | null;
  audioStoragePath: string;
  artworkStoragePath: string | null;
  genre: string;
  explicit: boolean;
};

export type LibraryTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  playlistId: string;
  lyrics: string | null;
  durationSeconds: number | null;
  playCount: number;
  lastPlayedAt: number | null;
  playedAtLog: number[];
  source: "local" | "cloud";
  audioBlob?: Blob;
  artworkBlob?: Blob | null;
  audioStoragePath?: string;
  artworkStoragePath?: string | null;
  audioPlaybackUrl?: string | null;
  artworkPlaybackUrl?: string | null;
};

export function fromLocalSong(song: LocalSong): LibraryTrack {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    releaseYear: song.releaseYear,
    playlistId: song.playlistId,
    lyrics: song.lyrics,
    durationSeconds: song.durationSeconds,
    playCount: song.playCount,
    lastPlayedAt: song.lastPlayedAt,
    playedAtLog: song.playedAtLog,
    source: "local",
    audioBlob: song.audioBlob,
    artworkBlob: song.artworkBlob,
  };
}

export function fromCloudSongDto(row: CloudSongDto): LibraryTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    releaseYear: row.releaseYear,
    playlistId: row.playlistId,
    lyrics: row.lyrics,
    durationSeconds: row.durationSeconds,
    playCount: 0,
    lastPlayedAt: null,
    playedAtLog: [],
    source: "cloud",
    audioStoragePath: row.audioStoragePath,
    artworkStoragePath: row.artworkStoragePath,
  };
}

export function trackArtworkSrc(track: LibraryTrack | null): string | null {
  if (!track || track.source !== "cloud") return null;
  return track.artworkPlaybackUrl ?? null;
}

export function trackHasArtBlob(track: LibraryTrack): track is LibraryTrack & {
  artworkBlob: Blob;
} {
  return track.source === "local" && track.artworkBlob instanceof Blob;
}
