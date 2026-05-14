import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { resolveDatabaseUrl } from "@/db/database-url";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  musePgSql: postgres.Sql | undefined;
  museDrizzle: PostgresJsDatabase<typeof schema> | undefined;
};

export type DrizzleMuseDb = PostgresJsDatabase<typeof schema>;

function isSupabaseHost(url: string): boolean {
  return /\.supabase\.(?:co|com)\b/i.test(url);
}

function shouldUseSsl(url: string): boolean {
  if (/sslmode=require/i.test(url) || /\bssl=require\b/i.test(url)) {
    return false;
  }
  return isSupabaseHost(url);
}

export function databaseUrl(): string {
  return resolveDatabaseUrl();
}

export function getDb(): DrizzleMuseDb {
  if (!globalForDb.musePgSql) {
    const url = resolveDatabaseUrl();
    const supabase = isSupabaseHost(url);
    globalForDb.musePgSql = postgres(url, {
      max: Math.min(Number(process.env.DATABASE_POOL_MAX ?? "10"), 20),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ...(supabase ? { fetch_types: false as const } : {}),
      ...(shouldUseSsl(url) ? ({ ssl: "require" } as const) : {}),
    });
    globalForDb.museDrizzle = drizzle(globalForDb.musePgSql, { schema });
  }
  return globalForDb.museDrizzle!;
}
