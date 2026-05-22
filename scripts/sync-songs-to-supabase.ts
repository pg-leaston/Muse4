/**
 * Push every song under Songs/ to Supabase Storage + public.songs.
 *
 * Required in .env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (Dashboard → Settings → API → service_role)
 *
 * Owner (pick one):
 *   MUSE_OWNER_USER_ID  — auth.users UUID, or
 *   MUSE_OWNER_EMAIL    — looked up via DATABASE_URL (default: 67easton@gmail.com)
 *
 * Run: npm run songs:sync
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env") });

async function resolveOwnerUserId(): Promise<string> {
  const { readMuseOwnerUserId, isValidMuseOwnerUserId, isValidServiceRoleConfigured } =
    await import("../src/lib/supabase/env");

  if (!isValidServiceRoleConfigured()) {
    console.error(
      "\nMissing real SUPABASE_SERVICE_ROLE_KEY in .env\n" +
        "  Supabase Dashboard → Project Settings → API → service_role (secret)\n" +
        "  Add: SUPABASE_SERVICE_ROLE_KEY=eyJ...\n",
    );
    process.exit(1);
  }

  if (isValidMuseOwnerUserId()) {
    return readMuseOwnerUserId()!;
  }

  const email = (
    process.env.MUSE_OWNER_EMAIL ?? "67easton@gmail.com"
  )
    .trim()
    .toLowerCase();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Set MUSE_OWNER_USER_ID or DATABASE_URL + MUSE_OWNER_EMAIL in .env");
    process.exit(1);
  }

  const sql = postgres(dbUrl, { max: 1 });
  const rows = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = ${email} limit 1
  `;
  await sql.end();

  if (!rows[0]?.id) {
    console.error(`No auth user found for ${email}. Create the account in Supabase Auth first.`);
    process.exit(1);
  }

  console.log(`Using owner ${email} → ${rows[0].id}`);
  return rows[0].id;
}

async function main() {
  const { scanSongsLibrary } = await import("../src/lib/songs-folder/scan");
  const { defaultSongsRoot } = await import("../src/lib/songs-folder/paths");
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { syncScannedSongsBatch } = await import(
    "../src/lib/music-library/sync-to-supabase"
  );

  const userId = await resolveOwnerUserId();
  const root = defaultSongsRoot();
  console.log(`Scanning ${root}…`);
  const scan = await scanSongsLibrary(root);
  console.log(`Found ${scan.songs.length} song folders.\n`);

  if (scan.songs.length === 0) {
    console.log("Nothing to upload. Add folders under Songs/All/…");
    return;
  }

  const supabase = createAdminClient();
  const batchSize = 5;
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < scan.songs.length; i += batchSize) {
    const batch = scan.songs.slice(i, i + batchSize);
    const summary = await syncScannedSongsBatch({
      supabase,
      userId,
      songsRoot: root,
      songs: batch,
      startSortOrder: i,
    });
    imported += summary.imported;
    skipped += summary.skipped;
    failed += summary.failed;

    for (const o of summary.outcomes) {
      if (o.result === "failed" && o.error && errors.length < 8) {
        errors.push(`${o.title}: ${o.error}`);
      }
    }

    const last = batch[batch.length - 1]?.title ?? "";
    console.log(
      `[${Math.min(i + batchSize, scan.songs.length)}/${scan.songs.length}] ${last} (+${summary.imported} ok, ${summary.skipped} skip, ${summary.failed} fail)`,
    );
  }

  console.log(
    `\nDone. Imported ${imported}, skipped ${skipped}, failed ${failed}.`,
  );
  if (errors.length > 0) {
    console.log("\nSample errors:");
    for (const e of errors) console.log(`  • ${e}`);
  }
  if (imported === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
