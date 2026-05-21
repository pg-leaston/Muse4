/** Normalize for loose "title appears in video title" matching. */
export function normalizeForTitleMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the song title shows up inside the YouTube video title
 * (substring or all significant words present).
 */
export function songTitleInVideoTitle(
  songTitle: string,
  videoTitle: string,
): boolean {
  const song = normalizeForTitleMatch(songTitle);
  const video = normalizeForTitleMatch(videoTitle);
  if (!song || !video) return false;

  if (video.includes(song)) return true;

  const words = song.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) {
    return video.includes(song);
  }

  return words.every((word) => video.includes(word));
}

/** Higher = better match (for sorting). */
export function scoreTitleMatch(songTitle: string, videoTitle: string): number {
  const song = normalizeForTitleMatch(songTitle);
  const video = normalizeForTitleMatch(videoTitle);
  if (!song || !video) return 0;

  if (video === song) return 100;
  if (video.startsWith(song)) return 90;
  if (video.includes(song)) return 80;

  const words = song.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return video.includes(song) ? 50 : 0;

  const matched = words.filter((w) => video.includes(w)).length;
  if (matched === words.length) return 60 + matched;
  if (matched > 0) return 30 + matched;
  return 0;
}
