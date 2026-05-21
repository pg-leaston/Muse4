const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const COVER_ART_API = "https://coverartarchive.org";

const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ??
  "Muse4/0.1 (https://github.com/muse4; local-dev)";

export type MusicMatch = {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  artworkUrl: string | null;
};

type MbRecording = {
  id: string;
  title: string;
  "artist-credit"?: { name: string; artist?: { name: string } }[];
  releases?: {
    id: string;
    title: string;
    date?: string;
  }[];
};

type MbSearchResponse = {
  recordings?: MbRecording[];
};

function parseReleaseYear(date?: string): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
}

function buildSearchQuery(title: string, artist: string): string {
  const parts: string[] = [];
  const t = title.trim();
  const a = artist.trim();
  if (t) parts.push(`recording:"${t.replace(/"/g, '\\"')}"`);
  if (a) parts.push(`artist:"${a.replace(/"/g, '\\"')}"`);
  return parts.length > 0 ? parts.join(" AND ") : t || a;
}

async function mbFetch(path: string): Promise<Response> {
  const res = await fetch(`${MUSICBRAINZ_API}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`MusicBrainz request failed (${res.status}).`);
  }
  return res;
}

async function resolveCoverArtUrl(releaseId: string): Promise<string | null> {
  try {
    const res = await fetch(`${COVER_ART_API}/release/${releaseId}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      images?: { front?: boolean; thumbnails?: { small?: string; large?: string } }[];
    };
    const front = data.images?.find((img) => img.front);
    return (
      front?.thumbnails?.large ??
      front?.thumbnails?.small ??
      null
    );
  } catch {
    return null;
  }
}

function mapRecording(rec: MbRecording, artworkUrl: string | null): MusicMatch {
  const artist =
    rec["artist-credit"]
      ?.map((c) => c.name || c.artist?.name)
      .filter(Boolean)
      .join(", ") ?? "";

  const release = rec.releases?.[0];
  return {
    id: rec.id,
    title: rec.title,
    artist,
    album: release?.title ?? "",
    releaseYear: parseReleaseYear(release?.date),
    artworkUrl,
  };
}

async function lookupRecording(id: string): Promise<MbRecording | null> {
  const res = await mbFetch(
    `/recording/${id}?inc=artist-credits+releases&fmt=json`,
  );
  return (await res.json()) as MbRecording;
}

export async function searchRecordings(
  title: string,
  artist: string,
  limit = 5,
): Promise<MusicMatch[]> {
  const query = buildSearchQuery(title, artist);
  if (!query.trim()) return [];
  return searchRecordingsByQuery(query, limit, { detailedFirst: true });
}

export async function searchRecordingsByQuery(
  query: string,
  limit = 8,
  options: { detailedFirst?: boolean } = {},
): Promise<MusicMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    query: trimmed,
    fmt: "json",
    limit: String(limit),
  });

  const res = await mbFetch(`/recording?${params}`);
  const data = (await res.json()) as MbSearchResponse;
  const hits = data.recordings ?? [];
  if (hits.length === 0) return [];

  if (!options.detailedFirst) {
    return hits.map((hit) => mapRecording(hit, null));
  }

  const topDetailed = await lookupRecording(hits[0].id);
  const topReleaseId = topDetailed?.releases?.[0]?.id;
  const topArtwork =
    topReleaseId ? await resolveCoverArtUrl(topReleaseId) : null;

  return hits.map((hit, index) => {
    const rec = index === 0 && topDetailed ? topDetailed : hit;
    return mapRecording(rec, index === 0 ? topArtwork : null);
  });
}

export async function getRecordingMatch(id: string): Promise<MusicMatch | null> {
  const rec = await lookupRecording(id);
  if (!rec) return null;
  const releaseId = rec.releases?.[0]?.id;
  const artworkUrl = releaseId ? await resolveCoverArtUrl(releaseId) : null;
  return mapRecording(rec, artworkUrl);
}
