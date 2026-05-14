/**
 * Reads Supabase-related env vars. Trims whitespace (common source of stray runtime failures).
 */
export function readSupabaseUrl(): string | undefined {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function readSupabasePublishableOrAnonKey(): string | undefined {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const p =
    typeof publishable === "string" && publishable.trim() ?
      publishable.trim()
    : undefined;
  const a = typeof anon === "string" && anon.trim() ? anon.trim() : undefined;
  return p ?? a ?? undefined;
}

export function readSupabaseServerAnonKey(): string | undefined {
  const v = process.env.SUPABASE_ANON_KEY;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readSupabaseUrl() && readSupabasePublishableOrAnonKey());
}
