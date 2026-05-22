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

export function readSupabaseServiceRoleKey(): string | undefined {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function readMuseOwnerUserId(): string | undefined {
  const v = process.env.MUSE_OWNER_USER_ID;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Detects placeholder values from .env templates (not real Supabase secrets). */
export function isPlaceholderEnvValue(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return (
    v.includes("your_") ||
    v.includes("replace") ||
    v === "your_service_role_key" ||
    v === "your-auth-user-uuid" ||
    v === "your_publishable_or_anon_key"
  );
}

export function isValidServiceRoleConfigured(): boolean {
  const key = readSupabaseServiceRoleKey();
  return Boolean(key && !isPlaceholderEnvValue(key));
}

export function isValidMuseOwnerUserId(): boolean {
  const id = readMuseOwnerUserId();
  return Boolean(id && UUID_RE.test(id));
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readSupabaseUrl() && readSupabasePublishableOrAnonKey());
}

export function isSupabaseSyncConfigured(): boolean {
  return Boolean(
    isSupabaseConfigured() &&
      isValidServiceRoleConfigured() &&
      isValidMuseOwnerUserId(),
  );
}

/** Comma-separated hostnames for phone/LAN dev (e.g. 192.168.1.100). */
export function readAllowedDevOrigins(): string[] {
  const raw = process.env.ALLOWED_DEV_ORIGINS;
  const fromEnv =
    typeof raw === "string" ?
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (fromEnv.length > 0) return fromEnv;
  return ["192.168.1.100", "192.168.*", "10.*"];
}
