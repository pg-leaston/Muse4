import type { LocalSong } from "@/lib/music-library/idb";

export type TopPlayedEntry = {
  song: LocalSong;
  playsInPeriod: number;
};

export type PlayPeriod = "month" | "year";

export function getPeriodBounds(
  period: PlayPeriod,
  ref: Date = new Date(),
): { start: number; end: number } {
  if (period === "month") {
    return {
      start: new Date(ref.getFullYear(), ref.getMonth(), 1).getTime(),
      end: new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime(),
    };
  }
  return {
    start: new Date(ref.getFullYear(), 0, 1).getTime(),
    end: new Date(ref.getFullYear() + 1, 0, 1).getTime(),
  };
}

export function getPeriodLabel(
  period: PlayPeriod,
  ref: Date = new Date(),
): string {
  if (period === "month") {
    return ref.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  return String(ref.getFullYear());
}

export function countPlaysInRange(
  timestamps: number[],
  start: number,
  end: number,
): number {
  return timestamps.filter((ts) => ts >= start && ts < end).length;
}

export function getTopPlayedSongs(
  songs: LocalSong[],
  period: PlayPeriod,
  limit = 10,
  ref: Date = new Date(),
): TopPlayedEntry[] {
  const { start, end } = getPeriodBounds(period, ref);
  const entries: TopPlayedEntry[] = [];

  for (const song of songs) {
    const plays = countPlaysInRange(song.playedAtLog ?? [], start, end);
    if (plays > 0) {
      entries.push({ song, playsInPeriod: plays });
    }
  }

  entries.sort((a, b) => {
    if (b.playsInPeriod !== a.playsInPeriod) {
      return b.playsInPeriod - a.playsInPeriod;
    }
    const aLast = a.song.lastPlayedAt ?? 0;
    const bLast = b.song.lastPlayedAt ?? 0;
    return bLast - aLast;
  });

  return entries.slice(0, limit);
}
