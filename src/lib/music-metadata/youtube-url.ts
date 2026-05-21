const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export function isYouTubeUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return YOUTUBE_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function normalizeYouTubeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!isYouTubeUrl(trimmed)) {
    throw new Error("Enter a valid YouTube link (youtube.com or youtu.be).");
  }
  return trimmed;
}
