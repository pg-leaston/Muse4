import { NextResponse } from "next/server";

import { scanSongsLibrary } from "@/lib/songs-folder/scan";
import { defaultSongsRoot } from "@/lib/songs-folder/paths";

export const runtime = "nodejs";

export async function GET() {
  try {
    const root = defaultSongsRoot();
    const scan = await scanSongsLibrary(root);

    return NextResponse.json({
      ...scan,
      songs: scan.songs.map((song) => ({
        id: song.id,
        playlistId: song.playlistId,
        folderName: song.folderName,
        title: song.title,
        artist: song.artist,
        album: song.album,
        releaseYear: song.releaseYear,
        hasLyrics: Boolean(song.lyrics?.trim()),
        audioRelativePath: song.audioRelativePath,
        artworkRelativePath: song.artworkRelativePath,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Library scan failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
