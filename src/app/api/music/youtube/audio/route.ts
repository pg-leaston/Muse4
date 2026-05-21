import { NextResponse } from "next/server";

import { downloadYouTubeAudio } from "@/lib/music-metadata/youtube-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const { buffer, contentType, filename } = await downloadYouTubeAudio(
      body.url ?? "",
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not download from YouTube.";
    const hint =
      /ffmpeg|ffprobe/i.test(message) ?
        " Install ffmpeg and add it to your PATH, then try again."
      : "";
    return NextResponse.json(
      { error: `${message}${hint}` },
      { status: 400 },
    );
  }
}
