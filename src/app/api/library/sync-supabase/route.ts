import { NextResponse } from "next/server";

import { syncScannedSongsBatch } from "@/lib/music-library/sync-to-supabase";
import { defaultSongsRoot } from "@/lib/songs-folder/paths";
import { scanSongsLibrary } from "@/lib/songs-folder/scan";
import { resolveSyncUserContext } from "@/lib/supabase/resolve-sync-user";

export const runtime = "nodejs";
export const maxDuration = 300;

type SyncBody = {
  offset?: number;
  limit?: number;
  playlistId?: string;
};

export async function POST(request: Request) {
  const ctx = await resolveSyncUserContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    body = {};
  }

  const offset = Math.max(0, Number(body.offset ?? 0));
  const limit = Math.min(Math.max(1, Number(body.limit ?? 3)), 10);
  const playlistId = body.playlistId?.trim();

  try {
    const root = defaultSongsRoot();
    const scan = await scanSongsLibrary(root);
    let targets = scan.songs;
    if (playlistId) {
      targets = targets.filter((s) => s.playlistId === playlistId);
    }

    const batch = targets.slice(offset, offset + limit);
    if (batch.length === 0) {
      return NextResponse.json({
        done: true,
        total: targets.length,
        offset,
        imported: 0,
        skipped: 0,
        failed: 0,
        outcomes: [],
      });
    }

    const summary = await syncScannedSongsBatch({
      supabase: ctx.supabase,
      userId: ctx.userId,
      songsRoot: root,
      songs: batch,
      startSortOrder: offset,
    });

    const nextOffset = offset + batch.length;
    return NextResponse.json({
      done: nextOffset >= targets.length,
      total: targets.length,
      offset: nextOffset,
      ...summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
