import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import youtubedl from "youtube-dl-exec";

import {
  normalizeForTitleMatch,
  scoreTitleMatch,
  songTitleInVideoTitle,
} from "@/lib/music-metadata/match-video-title";
import { parseVideoTitle } from "@/lib/music-metadata/parse-video-title";
import { normalizeYouTubeUrl } from "@/lib/music-metadata/youtube-url";

export type YouTubeVideoInfo = {
  url: string;
  videoTitle: string;
  parsedTitle: string;
  parsedArtist: string;
  videoId: string | null;
};

type YtMetadata = {
  title?: string;
  id?: string;
};

type YtSearchEntry = {
  id?: string;
  title?: string;
  url?: string;
  webpage_url?: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  thumbnails?: { url?: string; height?: number }[];
};

type YtSearchPayload = {
  entries?: YtSearchEntry[];
  id?: string;
  title?: string;
  url?: string;
};

async function fetchYtMetadata(url: string): Promise<YtMetadata> {
  const raw = await youtubedl(url, {
    dumpSingleJson: true,
    noPlaylist: true,
    skipDownload: true,
  });
  if (typeof raw === "string") {
    return JSON.parse(raw) as YtMetadata;
  }
  return raw as YtMetadata;
}

export async function getYouTubeVideoInfo(rawUrl: string): Promise<YouTubeVideoInfo> {
  const url = normalizeYouTubeUrl(rawUrl);
  const metadata = await fetchYtMetadata(url);
  const videoTitle = metadata.title?.trim() || "Untitled";
  const parsed = parseVideoTitle(videoTitle);

  return {
    url,
    videoTitle,
    parsedTitle: parsed.title,
    parsedArtist: parsed.artist,
    videoId: metadata.id ?? null,
  };
}

async function findAudioFile(dir: string): Promise<string> {
  const names = await readdir(dir);
  const audio = names.find((name) =>
    /\.(mp3|m4a|opus|webm|ogg|aac)$/i.test(name),
  );
  if (!audio) {
    throw new Error("Download finished but no audio file was produced.");
  }
  return join(dir, audio);
}

export type YouTubeAudioResult = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  info: YouTubeVideoInfo;
};

export type YouTubeVideoResult = {
  id: string;
  title: string;
  url: string;
  channel: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

function pickThumbnail(entry: YtSearchEntry): string | null {
  const thumbs = entry.thumbnails ?? [];
  if (thumbs.length === 0) return null;
  const sorted = [...thumbs].sort(
    (a, b) => (b.height ?? 0) - (a.height ?? 0),
  );
  return sorted[0]?.url ?? null;
}

function parseYtPayload(raw: unknown): YtSearchPayload {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as YtSearchPayload;
}

function listEntries(data: YtSearchPayload): YtSearchEntry[] {
  return data.entries ?? (data.id ? [data as YtSearchEntry] : []);
}

async function ytSearchWithTitles(
  query: string,
  playlistEnd: number,
): Promise<YtSearchEntry[]> {
  try {
    const raw = await youtubedl(`ytsearch${playlistEnd}:${query}`, {
      dumpSingleJson: true,
      skipDownload: true,
      playlistEnd,
    });
    const entries = listEntries(parseYtPayload(raw));
    if (entries.some((e) => e.title?.trim())) return entries;
  } catch {
    // fall through
  }

  try {
    const raw = await youtubedl(`ytsearch${playlistEnd}:${query}`, {
      dumpSingleJson: true,
      flatPlaylist: true,
      skipDownload: true,
      playlistEnd,
    });
    return listEntries(parseYtPayload(raw));
  } catch {
    return [];
  }
}

function entryVideoId(entry: YtSearchEntry): string | null {
  const id = entry.id;
  if (id && /^[\w-]{11}$/.test(id)) return id;

  const link = entry.url ?? entry.webpage_url ?? "";
  const match = link.match(/[?&]v=([\w-]{11})/);
  return match?.[1] ?? null;
}

function normalizeSearchEntry(entry: YtSearchEntry): YouTubeVideoResult | null {
  const id = entryVideoId(entry);
  if (!id) return null;

  const url = entry.url ?? entry.webpage_url ?? `https://www.youtube.com/watch?v=${id}`;

  return {
    id,
    title: entry.title?.trim() || "Untitled video",
    url,
    channel: (entry.channel ?? entry.uploader ?? "").trim(),
    durationSeconds:
      typeof entry.duration === "number" && entry.duration > 0 ?
        entry.duration
      : null,
    thumbnailUrl: pickThumbnail(entry),
  };
}

export function splitArtistNames(artist: string): string[] {
  const parts = artist
    .split(/\s*(?:,|&| feat\.? | ft\.? | x | \/ )\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [artist.trim()].filter(Boolean);
}

function artistAppearsInResult(artist: string, video: YouTubeVideoResult): boolean {
  const names = splitArtistNames(artist);
  const haystack = normalizeForTitleMatch(
    `${video.title} ${video.channel}`,
  );
  return names.some((name) => {
    const needle = normalizeForTitleMatch(name);
    return needle.length > 0 && haystack.includes(needle);
  });
}

function buildYouTubeSearchQuery(title: string, artist: string): string {
  return [artist.trim(), title.trim()].filter(Boolean).join(" ");
}

function scoreSearchResult(
  songTitle: string,
  artist: string,
  video: YouTubeVideoResult,
): number {
  let score = 0;

  if (songTitle && songTitleInVideoTitle(songTitle, video.title)) {
    score += scoreTitleMatch(songTitle, video.title);
  }

  if (artist && artistAppearsInResult(artist, video)) {
    score += 30;
  }

  if (/official|music video|audio/i.test(video.title)) {
    score += 5;
  }

  return score;
}

export async function searchYouTubeVideos(
  title: string,
  artist: string,
  limit = 6,
): Promise<YouTubeVideoResult[]> {
  const songTitle = title.trim();
  const query = buildYouTubeSearchQuery(songTitle, artist);
  if (!query) return [];

  const capped = Math.min(Math.max(limit, 1), 12);
  const fetchCount = Math.min(capped * 3, 25);

  const entries = await ytSearchWithTitles(query, fetchCount);
  const seen = new Set<string>();
  const scored: { video: YouTubeVideoResult; score: number }[] = [];

  for (const entry of entries) {
    const video = normalizeSearchEntry(entry);
    if (!video || seen.has(video.id)) continue;
    seen.add(video.id);
    scored.push({
      video,
      score: scoreSearchResult(songTitle, artist, video),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  const strong = scored.filter((row) => row.score >= 10);
  const pool = strong.length > 0 ? strong : scored;

  return pool.slice(0, capped).map((row) => row.video);
}

export async function downloadYouTubeAudio(
  rawUrl: string,
): Promise<YouTubeAudioResult> {
  const info = await getYouTubeVideoInfo(rawUrl);
  let tempDir: string | null = null;

  try {
    tempDir = await mkdtemp(join(tmpdir(), "muse4-yt-"));
    const outputTemplate = join(tempDir, "%(id)s.%(ext)s");

    try {
      await youtubedl(info.url, {
        extractAudio: true,
        audioFormat: "mp3",
        audioQuality: 0,
        output: outputTemplate,
        noPlaylist: true,
        preferFfmpeg: true,
      });
    } catch {
      await youtubedl(info.url, {
        format: "bestaudio/best",
        output: outputTemplate,
        noPlaylist: true,
      });
    }

    const filePath = await findAudioFile(tempDir);
    const buffer = await readFile(filePath);
    const isMp3 = filePath.toLowerCase().endsWith(".mp3");
    const baseName = info.parsedTitle || info.videoTitle || "track";

    return {
      buffer,
      contentType: isMp3 ? "audio/mpeg" : "application/octet-stream",
      filename: `${baseName}.${isMp3 ? "mp3" : "audio"}`,
      info,
    };
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
