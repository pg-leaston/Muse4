import { NextResponse } from "next/server";

import { searchYouTubeVideos } from "@/lib/music-metadata/youtube-server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") ?? "";
    const artist = searchParams.get("artist") ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? "6"), 12);

    if (!title.trim() && !artist.trim()) {
      return NextResponse.json(
        { error: "Provide a title or artist." },
        { status: 400 },
      );
    }

    const videos = await searchYouTubeVideos(title, artist, limit);
    return NextResponse.json({ videos });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "YouTube search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
