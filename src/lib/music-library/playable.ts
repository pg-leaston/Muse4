/** Tracks with no readable duration (0:00) are hidden and excluded from shuffle. */
export function isPlayableTrack(song: {
  durationSeconds: number | null;
}): boolean {
  const d = song.durationSeconds;
  return d != null && Number.isFinite(d) && d > 0;
}

export function filterPlayableTracks<T extends { durationSeconds: number | null }>(
  songs: T[],
): T[] {
  return songs.filter(isPlayableTrack);
}
