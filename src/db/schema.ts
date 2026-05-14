import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
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
    /** Optional cover in the `track-artwork` bucket */
    artworkStoragePath: text("artwork_storage_path"),
    durationSeconds: doublePrecision("duration_seconds"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("songs_user_id_sort_idx").on(t.userId, t.sortOrder)],
);

export type SongRow = typeof songs.$inferSelect;
export type SongInsert = typeof songs.$inferInsert;
