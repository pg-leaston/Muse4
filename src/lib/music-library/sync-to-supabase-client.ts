"use client";

export type CloudSyncProgress = {
  done: number;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  currentTitle: string;
};

export type CloudSyncResult = {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  sampleErrors: string[];
};

export async function syncLibraryToSupabase(options: {
  /** When true, cookies must include a signed-in session (uploads to your account). */
  onProgress?: (progress: CloudSyncProgress) => void;
  signal?: AbortSignal;
  batchSize?: number;
  playlistId?: string;
}): Promise<CloudSyncResult> {
  const batchSize = options.batchSize ?? 3;
  let offset = 0;
  let total = 0;
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let done = false;
  const sampleErrors: string[] = [];

  while (!done) {
    if (options.signal?.aborted) break;

    const res = await fetch("/api/library/sync-supabase", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset,
        limit: batchSize,
        playlistId: options.playlistId,
      }),
      signal: options.signal,
    });

    const data = (await res.json()) as {
      error?: string;
      done?: boolean;
      total?: number;
      offset?: number;
      imported?: number;
      skipped?: number;
      failed?: number;
      outcomes?: {
        title: string;
        result: string;
        error?: string;
      }[];
    };

    if (!res.ok) {
      throw new Error(data.error ?? "Cloud sync failed.");
    }

    total = data.total ?? total;
    offset = data.offset ?? offset;
    imported += data.imported ?? 0;
    skipped += data.skipped ?? 0;
    failed += data.failed ?? 0;
    done = Boolean(data.done);

    for (const outcome of data.outcomes ?? []) {
      if (
        outcome.result === "failed" &&
        outcome.error &&
        sampleErrors.length < 5
      ) {
        sampleErrors.push(`${outcome.title}: ${outcome.error}`);
      }
    }

    const lastTitle =
      data.outcomes?.[data.outcomes.length - 1]?.title ?? "";
    options.onProgress?.({
      done: offset,
      total,
      imported,
      skipped,
      failed,
      currentTitle: lastTitle,
    });
  }

  return { imported, skipped, failed, total, sampleErrors };
}
