import { NextResponse } from "next/server";

import { getRecordingMatch } from "@/lib/music-metadata/musicbrainz";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Recording id is required." },
        { status: 400 },
      );
    }

    const match = await getRecordingMatch(id);
    if (!match) {
      return NextResponse.json(
        { error: "Recording not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ match });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load recording.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
