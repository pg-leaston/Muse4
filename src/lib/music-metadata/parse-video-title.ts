const TRAILING_NOISE =
  /\s*[\(\[][^\)\]]*(official|video|audio|lyric|visualizer|mv|hd|4k|remaster|live|cover)[^\)\]]*[\)\]]/gi;

const SEPARATORS = [" - ", " – ", " — ", " | ", " · "] as const;

export type ParsedVideoTitle = {
  title: string;
  artist: string;
  raw: string;
};

export function parseVideoTitle(raw: string): ParsedVideoTitle {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(TRAILING_NOISE, "").trim();

  for (const sep of SEPARATORS) {
    const idx = cleaned.indexOf(sep);
    if (idx <= 0) continue;

    const left = cleaned.slice(0, idx).trim();
    const right = cleaned.slice(idx + sep.length).trim();
    if (!left || !right) continue;

    // "Artist - Song" is more common on YouTube than "Song - Artist".
    return { artist: left, title: right, raw };
  }

  return { title: cleaned, artist: "", raw };
}
