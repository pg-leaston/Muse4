"use client";

import { useEffect, useMemo } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { useAudioPlayer } from "@/contexts/audio-player-context";
import { formatTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  "File",
  "Song",
  "Album",
  "Playlist",
  "Account",
  "Controls",
  "Help",
  "Admin",
] as const;

export function PlayBar() {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    next,
    previous,
    setIsScrubbing,
  } = useAudioPlayer();

  const artUrl = useMemo(() => {
    if (!currentSong?.artworkBlob) return null;
    return URL.createObjectURL(currentSong.artworkBlob);
  }, [currentSong]);

  useEffect(() => {
    return () => {
      if (artUrl) URL.revokeObjectURL(artUrl);
    };
  }, [artUrl]);

  const hasTrack = Boolean(currentSong);
  const max = duration > 0 ? duration : 1;
  const disabled = !hasTrack;
  const title = currentSong?.title ?? "Nothing Playing";
  const artist = currentSong?.artist || "Load a track from your library";

  return (
    <div className="border-b border-white/10 bg-[#120022] text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/8 bg-black/12">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-white/75 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-3 sm:gap-5">
            {MENU_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className="transition hover:text-white"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="rounded-md border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white/85 uppercase">
            Local User
          </div>
        </div>
      </div>

      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(101,40,184,0.52),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(49,16,116,0.58),_transparent_24%),linear-gradient(180deg,_rgba(33,7,70,0.98),_rgba(13,2,28,0.98))]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />

        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex justify-center lg:justify-start">
              <div
                className="text-[clamp(3.8rem,8vw,5.6rem)] font-black italic leading-none text-white [text-shadow:0_6px_16px_rgba(0,0,0,0.45)]"
                style={{ fontFamily: "cursive" }}
              >
                Muse
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-center gap-4 text-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/25 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  {artUrl ?
                    // eslint-disable-next-line @next/next/no-img-element -- blob URLs from IndexedDB
                    <img
                      src={artUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  : <Music2 className="size-8 text-white/75" />}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xl font-black tracking-[0.16em] uppercase sm:text-3xl">
                    {title}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold tracking-[0.08em] text-white/72 sm:text-base">
                    {artist}
                  </p>
                </div>
              </div>

              <div className="flex w-full max-w-3xl items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/8 transition hover:bg-white/14",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                  aria-label="Previous track"
                  onClick={previous}
                >
                  <SkipBack className="size-4" />
                </button>

                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-white/82 sm:w-12">
                  {formatTime(currentTime)}
                </span>

                <input
                  type="range"
                  min={0}
                  max={max}
                  step={0.05}
                  value={Math.min(currentTime, max)}
                  disabled={disabled}
                  aria-label="Playback position"
                  className="muse-progress-range"
                  onChange={(event) => {
                    setIsScrubbing(true);
                    seek(Number(event.currentTarget.value));
                  }}
                  onMouseUp={() => setIsScrubbing(false)}
                  onTouchEnd={() => setIsScrubbing(false)}
                  onKeyUp={() => setIsScrubbing(false)}
                />

                <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-white/82 sm:w-12">
                  {formatTime(duration)}
                </span>

                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/8 transition hover:bg-white/14",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                  aria-label="Next track"
                  onClick={next}
                >
                  <SkipForward className="size-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "grid size-11 place-items-center rounded-full border border-white/30 bg-white/14 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-white/20",
                  disabled && "cursor-not-allowed opacity-40",
                )}
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={togglePlay}
              >
                {isPlaying ?
                  <Pause className="size-5" />
                : <Play className="ml-0.5 size-5 fill-current" />}
              </button>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
