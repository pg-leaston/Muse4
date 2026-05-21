"use client";

import { useEffect, useMemo } from "react";
import { Music2, Play } from "lucide-react";

import type { LocalSong } from "@/lib/music-library/idb";
import {
  getPeriodLabel,
  getTopPlayedSongs,
  type TopPlayedEntry,
} from "@/lib/music-library/top-played";
import { cn } from "@/lib/utils";

function MiniArtwork({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="absolute inset-0 size-full object-cover"
      draggable={false}
    />
  );
}

function TopPlayedList({
  title,
  periodLabel,
  entries,
  currentSongId,
  onPlay,
}: {
  title: string;
  periodLabel: string;
  entries: TopPlayedEntry[];
  currentSongId: string | null;
  onPlay: (entry: TopPlayedEntry) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-white">
          {title}
        </h3>
        <span className="shrink-0 text-[10px] font-medium tracking-[0.12em] text-white/45 uppercase">
          {periodLabel}
        </span>
      </div>

      {entries.length === 0 ?
        <p className="mt-3 text-xs leading-5 text-white/45">
          No plays recorded for this period yet.
        </p>
      : <ol className="mt-3 space-y-1.5">
          {entries.map((entry, index) => {
            const { song, playsInPeriod } = entry;
            const isCurrent = currentSongId === song.id;

            return (
              <li key={song.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition",
                    isCurrent ?
                      "bg-violet-500/20 text-white"
                    : "text-white/85 hover:bg-white/8",
                  )}
                  onClick={() => onPlay(entry)}
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-white/50">
                    {index + 1}
                  </span>
                  <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/12 bg-black/30">
                    {song.artworkBlob ?
                      <MiniArtwork blob={song.artworkBlob} />
                    : <Music2 className="size-4 text-white/55" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-tight">
                      {song.title}
                    </p>
                    <p className="truncate text-[11px] text-white/50">
                      {song.artist || "Unknown artist"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-violet-200/90">
                    {playsInPeriod}
                  </span>
                  <Play className="size-3.5 shrink-0 text-white/40" />
                </button>
              </li>
            );
          })}
        </ol>
      }
    </div>
  );
}

type TopPlayedPanelProps = {
  songs: LocalSong[];
  currentSongId: string | null;
  onPlaySong: (song: LocalSong) => void;
};

export function TopPlayedPanel({
  songs,
  currentSongId,
  onPlaySong,
}: TopPlayedPanelProps) {
  const topMonth = useMemo(
    () => getTopPlayedSongs(songs, "month"),
    [songs],
  );
  const topYear = useMemo(() => getTopPlayedSongs(songs, "year"), [songs]);
  const monthLabel = useMemo(() => getPeriodLabel("month"), []);
  const yearLabel = useMemo(() => getPeriodLabel("year"), []);

  return (
    <section className="rounded-[30px] border border-white/10 bg-black/15 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <h2 className="text-[1.65rem] font-semibold leading-tight text-white">
        Top played
      </h2>
      <p className="mt-1 text-xs text-white/50">
        Ranked by plays logged in your library
      </p>

      <div className="mt-5 space-y-6">
        <TopPlayedList
          title="This month"
          periodLabel={monthLabel}
          entries={topMonth}
          currentSongId={currentSongId}
          onPlay={(entry) => onPlaySong(entry.song)}
        />
        <div className="border-t border-white/10 pt-5">
          <TopPlayedList
            title="This year"
            periodLabel={yearLabel}
            entries={topYear}
            currentSongId={currentSongId}
            onPlay={(entry) => onPlaySong(entry.song)}
          />
        </div>
      </div>
    </section>
  );
}
