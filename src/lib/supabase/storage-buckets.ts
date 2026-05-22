/** Supabase Storage bucket ids (must match Dashboard / migrations). */
export const TRACKS_BUCKET = "tracks";
export const TRACK_ARTWORK_BUCKET = "track_artwork";

export type MuseStorageBucket = typeof TRACKS_BUCKET | typeof TRACK_ARTWORK_BUCKET;

export const MUSE_STORAGE_BUCKETS: MuseStorageBucket[] = [
  TRACKS_BUCKET,
  TRACK_ARTWORK_BUCKET,
];

export function isMuseStorageBucket(value: string): value is MuseStorageBucket {
  return (MUSE_STORAGE_BUCKETS as string[]).includes(value);
}
