export type SongInformation = {
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  genre: string;
  explicit: boolean;
};

const EMPTY_ALBUM = new Set([
  "none",
  "unknown",
  "unknown album",
  "release year not found",
  "n/a",
]);

function cleanValue(raw: string): string {
  return raw.trim();
}

function parseReleaseYear(value: string): number | null {
  const match = value.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
}

export function parseInformationFile(content: string): SongInformation {
  const lines = content.split(/\r?\n/);
  const map = new Map<string, string>();

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    map.set(key, value);
  }

  const albumRaw = cleanValue(map.get("album name") ?? "");
  const album =
    albumRaw && !EMPTY_ALBUM.has(albumRaw.toLowerCase()) ? albumRaw : "";

  const explicitRaw = (map.get("explicit") ?? "").toLowerCase();
  const explicit = explicitRaw === "true" || explicitRaw === "yes";

  return {
    title: cleanValue(map.get("title") ?? ""),
    artist: cleanValue(map.get("artist") ?? ""),
    album,
    releaseYear: parseReleaseYear(map.get("release year") ?? ""),
    genre: cleanValue(map.get("genre") ?? ""),
    explicit,
  };
}
