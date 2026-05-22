import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Matches `supabase/migrations/0001_songs.sql` — wire server actions once Supabase auth is ready. */
export const songs = pgTable(
  "songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull().default(""),
    album: text("album").notNull().default(""),
    releaseYear: integer("release_year"),
    /** Storage object path in the `tracks` bucket, e.g. `${userId}/${id}.mp3` */
    audioStoragePath: text("audio_storage_path").notNull(),
    /** Optional cover in the `track_artwork` bucket */
    artworkStoragePath: text("artwork_storage_path"),
    durationSeconds: doublePrecision("duration_seconds"),
    lyrics: text("lyrics"),
    playlistId: text("playlist_id").notNull().default(""),
    sourceKey: text("source_key"),
    genre: text("genre").notNull().default(""),
    explicit: boolean("explicit").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("songs_user_id_sort_idx").on(t.userId, t.sortOrder),
    uniqueIndex("songs_user_source_key_idx")
      .on(t.userId, t.sourceKey)
      .where(sql`${t.sourceKey} is not null`),
  ],
);

export type SongRow = typeof songs.$inferSelect;
export type SongInsert = typeof songs.$inferInsert;
