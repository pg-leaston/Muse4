import { NextResponse } from "next/server";

import { getYouTubeVideoInfo } from "@/lib/music-metadata/youtube-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const info = await getYouTubeVideoInfo(body.url ?? "");
    return NextResponse.json(info);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read YouTube video.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
