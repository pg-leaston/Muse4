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

import type { LocalSong } from "@/lib/music-library/idb";

type AudioPlayerContextValue = {
  queue: LocalSong[];
  currentIndex: number;
  currentSong: LocalSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isScrubbing: boolean;
  setIsScrubbing: (v: boolean) => void;
  playQueue: (songs: LocalSong[], startIndex: number) => void;
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
  const [queue, setQueue] = useState<LocalSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const currentSong = queue[currentIndex] ?? null;

  const audioUrl = useMemo(() => {
    if (!currentSong) return null;
    return URL.createObjectURL(currentSong.audioBlob);
  }, [currentSong]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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
    setCurrentIndex((i) => {
      if (q.length === 0) return 0;
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
  }, [isScrubbing, audioUrl, next]);

  const playQueue = useCallback((songs: LocalSong[], startIndex: number) => {
    if (songs.length === 0) return;
    const idx = Math.min(Math.max(0, startIndex), songs.length - 1);
    setQueue(songs);
    setCurrentIndex(idx);
    setIsPlaying(true);
  }, []);

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
        currentTime,
        duration,
        isScrubbing,
        setIsScrubbing,
        playQueue,
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
      currentTime,
      duration,
      isScrubbing,
      playQueue,
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
