import type { LocalSong } from "@/lib/music-library/idb";

/** Tracks with no readable duration (0:00) are hidden and excluded from shuffle. */
export function isPlayableTrack(song: LocalSong): boolean {
  const d = song.durationSeconds;
  return d != null && Number.isFinite(d) && d > 0;
}

export function filterPlayableTracks(songs: LocalSong[]): LocalSong[] {
  return songs.filter(isPlayableTrack);
}
