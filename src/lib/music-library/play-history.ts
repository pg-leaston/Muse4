export const PLAY_LOG_MAX = 100;
/** Seconds of playback before a session counts as a play. */
export const MIN_PLAY_SECONDS = 12;

export const PLAY_RECORDED_EVENT = "muse:play-recorded";

export type PlayRecordedDetail = {
  songId: string;
  playCount: number;
  lastPlayedAt: number;
  playedAtLog: number[];
};

export function formatPlayCount(count: number): string {
  if (count <= 0) return "Never played";
  if (count === 1) return "Played once";
  return `Played ${count} times`;
}

export function formatLastPlayed(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;

  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins}m ago`;
  }
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatPlayLogTooltip(timestamps: number[]): string {
  if (timestamps.length === 0) return "No plays yet";
  const recent = timestamps.slice(-8).reverse();
  const lines = recent.map((ts) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  });
  const older = timestamps.length - recent.length;
  if (older > 0) lines.push(`…and ${older} earlier`);
  return lines.join("\n");
}

export function dispatchPlayRecorded(detail: PlayRecordedDetail): void {
  window.dispatchEvent(
    new CustomEvent<PlayRecordedDetail>(PLAY_RECORDED_EVENT, { detail }),
  );
}
