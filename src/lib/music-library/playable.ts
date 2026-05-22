/** Hide only confirmed 0:00 tracks; unknown duration is still playable. */
export function isPlayableTrack(song: {
  durationSeconds: number | null;
}): boolean {
  const d = song.durationSeconds;
  if (d == null || !Number.isFinite(d)) return true;
  return d > 0;
}

export function filterPlayableTracks<T extends { durationSeconds: number | null }>(
  songs: T[],
): T[] {
  return songs.filter(isPlayableTrack);
}
