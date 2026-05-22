import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to load your cloud library." },
        { status: 401 },
      );
    }

    const { data: rows, error } = await supabase
      .from("songs")
      .select(
        "id, title, artist, album, release_year, playlist_id, lyrics, duration_seconds, audio_storage_path, artwork_storage_path, genre, explicit, sort_order",
      )
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const songs = (rows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist ?? "",
      album: row.album ?? "",
      releaseYear: row.release_year,
      playlistId: row.playlist_id ?? "",
      lyrics: row.lyrics,
      durationSeconds: row.duration_seconds,
      audioStoragePath: row.audio_storage_path,
      artworkStoragePath: row.artwork_storage_path,
      genre: row.genre ?? "",
      explicit: row.explicit ?? false,
    }));

    return NextResponse.json({ songs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud library failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
