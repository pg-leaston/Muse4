import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { resolveSongsFilePath } from "@/lib/songs-folder/scan";
import { defaultSongsRoot } from "@/lib/songs-folder/paths";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
};

function mimeForPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

export async function GET(request: Request) {
  try {
    const relative = new URL(request.url).searchParams.get("path")?.trim();
    if (!relative) {
      return NextResponse.json({ error: "Missing path." }, { status: 400 });
    }

    const absolute = resolveSongsFilePath(defaultSongsRoot(), relative);
    if (!absolute) {
      return NextResponse.json({ error: "Invalid path." }, { status: 400 });
    }

    const buffer = await readFile(absolute);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeForPath(absolute),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
