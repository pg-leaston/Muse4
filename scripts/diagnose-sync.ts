/**
 * Sample why Songs/ folders skip or fail during sync (does not upload).
 * Run: npx tsx --env-file=.env ./scripts/diagnose-sync.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { parseFile } from "music-metadata";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { scanSongsLibrary } = await import("../src/lib/songs-folder/scan");
  const { defaultSongsRoot } = await import("../src/lib/songs-folder/paths");
  const { resolveSongsFilePath } = await import("../src/lib/songs-folder/scan");

  const root = defaultSongsRoot();
  console.log(`Scanning ${root}…`);
  const scan = await scanSongsLibrary(root);
  console.log(`Total folders: ${scan.songs.length}\n`);

  let invalidPath = 0;
  let noDuration = 0;
  let ok = 0;
  const pathSamples: string[] = [];
  const durationSamples: string[] = [];

  const sampleSize = Math.min(scan.songs.length, 80);
  const step = Math.max(1, Math.floor(scan.songs.length / sampleSize));

  for (let i = 0; i < scan.songs.length; i += step) {
    const song = scan.songs[i];
    const abs = resolveSongsFilePath(root, song.audioRelativePath);
    if (!abs) {
      invalidPath++;
      if (pathSamples.length < 5) pathSamples.push(song.title);
      continue;
    }
    try {
      const meta = await parseFile(abs);
      const d = meta.format.duration;
      if (d != null && Number.isFinite(d) && d > 0) {
        ok++;
      } else {
        noDuration++;
        if (durationSamples.length < 5) {
          durationSamples.push(`${song.title} (dur=${d})`);
        }
      }
    } catch (err) {
      noDuration++;
      if (durationSamples.length < 5) {
        const msg = err instanceof Error ? err.message : String(err);
        durationSamples.push(`${song.title} (${msg.slice(0, 60)})`);
      }
    }
  }

  const sampled = Math.ceil(scan.songs.length / step);
  let okFast = 0;
  for (let i = 0; i < scan.songs.length; i += step) {
    const song = scan.songs[i];
    const abs = resolveSongsFilePath(root, song.audioRelativePath);
    if (!abs) continue;
    try {
      const meta = await parseFile(abs, { duration: true });
      const d = meta.format.duration;
      if (d != null && Number.isFinite(d) && d > 0) okFast++;
    } catch {
      /* ignore */
    }
  }

  console.log(`Sampled ~${sampled} tracks (every ${step}th):`);
  console.log(`  OK with sync’s old parse:    ~${ok}`);
  console.log(`  OK with duration:true:       ~${okFast}`);
  console.log(`  Skipped (0:00 / parse fail): ~${noDuration}`);
  console.log(`  Failed (invalid path):      ~${invalidPath}`);
  console.log(
    `\nExtrapolated for ${scan.songs.length} folders: ~${Math.round((okFast / sampled) * scan.songs.length)} would upload after the duration fix.`,
  );
  if (pathSamples.length) console.log("\nInvalid path examples:", pathSamples);
  if (durationSamples.length) {
    console.log("\nDuration/parse examples:", durationSamples);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
