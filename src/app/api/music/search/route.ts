import { NextResponse } from "next/server";

import {
  searchRecordings,
  searchRecordingsByQuery,
} from "@/lib/music-metadata/musicbrainz";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const title = searchParams.get("title") ?? "";
    const artist = searchParams.get("artist") ?? "";
    const limit = Math.min(
      Number(searchParams.get("limit") ?? "8"),
      12,
    );

    if (!q.trim() && !title.trim() && !artist.trim()) {
      return NextResponse.json(
        { error: "Provide a search query." },
        { status: 400 },
      );
    }

    const matches =
      title.trim() || artist.trim() ?
        await searchRecordings(title, artist, limit)
      : q.trim() ?
        await searchRecordingsByQuery(q, limit)
      : [];

    return NextResponse.json({ matches });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Metadata search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
