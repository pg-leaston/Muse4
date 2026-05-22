"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { listSongs, recordSongPlay } from "@/lib/music-library/idb";
import {
  attachSignedPlaybackUrls,
} from "@/lib/music-library/cloud-library";
import { fromLocalSong, type LibraryTrack } from "@/lib/music-library/library-track";
import { MIN_PLAY_SECONDS } from "@/lib/music-library/play-history";
import { filterPlayableTracks } from "@/lib/music-library/playable";

function pickRandomIndex(pool: LibraryTrack[], avoidId?: string): number {
  if (pool.length === 0) return 0;
  if (pool.length === 1) return 0;
  let idx = Math.floor(Math.random() * pool.length);
  let attempts = 0;
  while (avoidId && pool[idx]?.id === avoidId && attempts < 24) {
    idx = Math.floor(Math.random() * pool.length);
    attempts += 1;
  }
  return idx;
}

function resolveAudioSrc(track: LibraryTrack | null): string | null {
  if (!track) return null;
  if (track.source === "cloud") return track.audioPlaybackUrl ?? null;
  if (track.audioBlob) return URL.createObjectURL(track.audioBlob);
  return null;
}

type AudioPlayerContextValue = {
  queue: LibraryTrack[];
  currentIndex: number;
  currentSong: LibraryTrack | null;
  isPlaying: boolean;
  isShuffle: boolean;
  currentTime: number;
  duration: number;
  isScrubbing: boolean;
  setIsScrubbing: (v: boolean) => void;
  playQueue: (songs: LibraryTrack[], startIndex: number) => Promise<void>;
  startShuffle: (songs?: LibraryTrack[]) => Promise<void>;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  rewind: (seconds?: number) => void;
  next: () => void;
  previous: () => void;
  removeSongFromPlayer: (id: string) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<LibraryTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);
  const isShuffleRef = useRef(isShuffle);
  const playSessionRef = useRef<{ songId: string; recorded: boolean } | null>(
    null,
  );
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  const currentSong = queue[currentIndex] ?? null;

  useEffect(() => {
    if (!currentSong) {
      playSessionRef.current = null;
      return;
    }
    playSessionRef.current = { songId: currentSong.id, recorded: false };
  }, [currentSong?.id]);

  const tryRecordPlay = useCallback(() => {
    const session = playSessionRef.current;
    const song = queueRef.current[currentIndexRef.current];
    if (!session || !song || session.recorded || session.songId !== song.id) {
      return;
    }
    if (song.source !== "local") return;
    session.recorded = true;
    void recordSongPlay(song.id);
  }, []);

  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const session = playSessionRef.current;
    if (!session || session.songId !== currentSong.id || session.recorded) {
      return;
    }
    const trackDuration = currentSong.durationSeconds;
    const threshold =
      trackDuration != null && trackDuration > 0 && trackDuration < MIN_PLAY_SECONDS ?
        Math.max(3, trackDuration * 0.5)
      : MIN_PLAY_SECONDS;
    if (currentTime >= threshold) {
      tryRecordPlay();
    }
  }, [currentTime, isPlaying, currentSong, tryRecordPlay]);

  const audioUrl = useMemo(
    () => resolveAudioSrc(currentSong),
    [currentSong],
  );

  useEffect(() => {
    const url = audioUrl;
    const isLocalBlob = currentSong?.source === "local";
    return () => {
      if (url && isLocalBlob) URL.revokeObjectURL(url);
    };
  }, [audioUrl, currentSong?.source]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    el.src = audioUrl;
    el.load();
    setCurrentTime(0);
  }, [audioUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (isPlaying) {
      void el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, audioUrl]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) {
      setIsPlaying(false);
      return;
    }

    if (isShuffleRef.current) {
      const current = q[currentIndexRef.current];
      setCurrentIndex(pickRandomIndex(q, current?.id));
      setIsPlaying(true);
      return;
    }

    setCurrentIndex((i) => {
      const n = i + 1;
      if (n >= q.length) {
        setIsPlaying(false);
        return i;
      }
      return n;
    });
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      if (!isScrubbing) setCurrentTime(el.currentTime);
    };
    const onDur = () => {
      const d = el.duration;
      setDuration(Number.isFinite(d) ? d : 0);
    };
    const onEnded = () => {
      tryRecordPlay();
      next();
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("ended", onEnded);
    };
  }, [isScrubbing, audioUrl, next, tryRecordPlay]);

  const prepareQueue = useCallback(async (songs: LibraryTrack[]) => {
    const playable = filterPlayableTracks(songs);
    const needsSign = playable.some(
      (s) => s.source === "cloud" && !s.audioPlaybackUrl,
    );
    if (!needsSign) return playable;
    return attachSignedPlaybackUrls(playable);
  }, []);

  const playQueue = useCallback(
    async (songs: LibraryTrack[], startIndex: number) => {
      const playable = await prepareQueue(songs);
      if (playable.length === 0) return;
      const original = songs[startIndex];
      let resolvedIdx = 0;
      if (original) {
        const found = playable.findIndex((s) => s.id === original.id);
        if (found >= 0) resolvedIdx = found;
      }
      setIsShuffle(false);
      setQueue(playable);
      setCurrentIndex(Math.min(resolvedIdx, playable.length - 1));
      setIsPlaying(true);
    },
    [prepareQueue],
  );

  const startShuffle = useCallback(
    async (songs?: LibraryTrack[]) => {
      const source =
        songs ??
        (await listSongs()).map(fromLocalSong);
      const pool = await prepareQueue(source);
      if (pool.length === 0) return;
      setIsShuffle(true);
      setQueue(pool);
      setCurrentIndex(pickRandomIndex(pool));
      setIsPlaying(true);
    },
    [prepareQueue],
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const seek = useCallback(
    (time: number) => {
      const el = audioRef.current;
      if (!el || !audioUrl) return;
      const d = Number.isFinite(el.duration) ? el.duration : duration;
      const t = Math.min(Math.max(0, time), d > 0 ? d : time);
      el.currentTime = t;
      setCurrentTime(t);
    },
    [audioUrl, duration],
  );

  const rewind = useCallback(
    (seconds = 10) => {
      seek(Math.max(0, currentTime - seconds));
    },
    [currentTime, seek],
  );

  const previous = useCallback(() => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    if (isShuffleRef.current) {
      const q = queueRef.current;
      if (q.length === 0) return;
      const current = q[currentIndexRef.current];
      setCurrentIndex(pickRandomIndex(q, current?.id));
      return;
    }
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, [seek, currentTime]);

  const removeSongFromPlayer = useCallback((id: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const nextQ = prev.filter((s) => s.id !== id);
      setCurrentIndex((ci) => {
        if (nextQ.length === 0) {
          setIsPlaying(false);
          return 0;
        }
        if (idx < ci) return ci - 1;
        if (idx === ci) return Math.min(idx, nextQ.length - 1);
        return Math.min(ci, nextQ.length - 1);
      });
      return nextQ;
    });
  }, []);

  const value = useMemo(
    () =>
      ({
        queue,
        currentIndex,
        currentSong,
        isPlaying,
        isShuffle,
        currentTime,
        duration,
        isScrubbing,
        setIsScrubbing,
        playQueue,
        startShuffle,
        togglePlay,
        play,
        pause,
        seek,
        rewind,
        next,
        previous,
        removeSongFromPlayer,
      }) satisfies AudioPlayerContextValue,
    [
      queue,
      currentIndex,
      currentSong,
      isPlaying,
      isShuffle,
      currentTime,
      duration,
      isScrubbing,
      playQueue,
      startShuffle,
      togglePlay,
      play,
      pause,
      seek,
      rewind,
      next,
      previous,
      removeSongFromPlayer,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      <audio ref={audioRef} className="hidden" preload="metadata" />
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return ctx;
}
