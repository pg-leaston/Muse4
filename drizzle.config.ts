import { defineConfig } from "drizzle-kit";

import { resolveDatabaseUrl } from "./src/db/database-url";

function withConnectTimeout(url: string): string {
  const t = url.trim();
  if (/[?&]connect_timeout=/iu.test(t)) return t;
  const join = t.includes("?") ? "&" : "?";
  return `${t}${join}connect_timeout=15`;
}

function ensureSslForSupabase(url: string): string {
  const t = url.trim();
  if (!/\.supabase\.(?:co|com)\b/iu.test(t)) return t;
  if (/[?&]sslmode=/iu.test(t)) return t;
  const join = t.includes("?") ? "&" : "?";
  return `${t}${join}sslmode=require`;
}

const databaseUrl = ensureSslForSupabase(withConnectTimeout(resolveDatabaseUrl()));

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
