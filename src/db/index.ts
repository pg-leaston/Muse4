/**
 * Drizzle client — use in Server Components, route handlers, and scripts.
 *
 * ```ts
 * import { getDb } from "@/db";
 * import { songs } from "@/db/schema";
 *
 * const db = getDb();
 * const rows = await db.select().from(songs);
 * ```
 */
export { databaseUrl, getDb, type DrizzleMuseDb } from "./client";
export * from "./schema";
