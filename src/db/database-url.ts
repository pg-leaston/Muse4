/** Env keys we accept for the Postgres URI (same value Supabase labels “URI” under Database settings). Order matters: first wins. */
const POSTGRES_URI_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "SUPABASE_DATABASE_URL",
] as const;

const PLACEHOLDER_SNIPPETS = [
  /YOUR_DATABASE_PASSWORD/i,
  /YOUR_PASSWORD/i,
  /\[YOUR-PASSWORD\]/i,
];

function trimEnvConnString(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function jdbcParses(connectionString: string): boolean {
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:\/\//iu, "http://");
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}

/** Password characters that must be percent-encoded in a JDBC URL (e.g. `?` starts a query string). */
function passwordNeedsEncoding(connectionString: string): boolean {
  const protoMatch = /^postgres(ql)?:\/\//iu.exec(connectionString);
  if (!protoMatch) return false;
  const withoutProto = connectionString.slice(protoMatch[0].length);
  const at = withoutProto.lastIndexOf("@");
  if (at <= 0) return false;
  const userinfo = withoutProto.slice(0, at);
  const colon = userinfo.indexOf(":");
  if (colon < 0) return false;
  const rawPassword = userinfo.slice(colon + 1);
  return /[^A-Za-z0-9._~-]/.test(rawPassword);
}

/** True when URL.parse would drop or corrupt the password (common if it starts with `?`, `#`, `@`). */
function credentialsRoundTripBroken(connectionString: string): boolean {
  if (!jdbcParses(connectionString)) return true;
  const protoMatch = /^postgres(ql)?:\/\//iu.exec(connectionString);
  if (!protoMatch) return true;
  const withoutProto = connectionString.slice(protoMatch[0].length);
  const at = withoutProto.lastIndexOf("@");
  if (at <= 0) return true;
  const userinfo = withoutProto.slice(0, at);
  const colon = userinfo.indexOf(":");
  if (colon < 0) return true;
  const rawPassword = userinfo.slice(colon + 1);
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:\/\//iu, "http://");
    const u = new URL(normalized);
    const parsedPassword = decodeURIComponent(u.password);
    return parsedPassword !== rawPassword;
  } catch {
    return true;
  }
}

function coerceParseablePostgreSqlJdbcUrl(connectionString: string): string {
  const mustEncode =
    passwordNeedsEncoding(connectionString) ||
    credentialsRoundTripBroken(connectionString);

  if (jdbcParses(connectionString) && !mustEncode) {
    return connectionString;
  }

  const protoMatch = /^postgres(ql)?:\/\//iu.exec(connectionString);
  if (!protoMatch) throw new Error("Expected postgresql:// or postgres:// URI.");
  const proto = protoMatch[0];
  const withoutProto = connectionString.slice(proto.length);

  const at = withoutProto.lastIndexOf("@");
  if (at <= 0) {
    throw new Error(
      "DATABASE_URL is missing `@` between credentials and host (or `@` appears only at the wrong place). If your password literally contains `@`, it must appear as %40 inside the URI.",
    );
  }

  const userinfo = withoutProto.slice(0, at);
  const hostAndRest = withoutProto.slice(at + 1);
  if (!userinfo.includes(":")) {
    throw new Error(
      "DATABASE_URL userinfo must be `user:password` (colon between database user name and password).",
    );
  }

  const colon = userinfo.indexOf(":");
  const rawUser = userinfo.slice(0, colon);
  const rawPassword = userinfo.slice(colon + 1);

  const hostProbe = `http://${hostAndRest}`;
  try {
    new URL(hostProbe);
  } catch (cause) {
    throw new Error(
      [
        "Could not parse host / port / database segment of DATABASE_URL after credentials.",
        "Check hostname, port (:5432 or :6543), and trailing `/dbname`.",
      ].join(" "),
      { cause },
    );
  }

  const rebuilt =
    `${proto}${encodeURIComponent(rawUser)}:${encodeURIComponent(rawPassword)}@${hostAndRest}`;

  if (!jdbcParses(rebuilt)) {
    throw new Error(
      [
        "After normalizing DATABASE_URL credentials, URI still fails URL parsing.",
        "Try resetting the Postgres password (Supabase → Database → reset) and copying a fresh encoded URI.",
      ].join(" "),
    );
  }

  return rebuilt;
}

function assertPostgresJdbcUrl(connectionString: string): void {
  if (/^file:/iu.test(connectionString)) {
    throw new Error(
      [
        "Postgres URI is a SQLite-style `file:` URL (often a leftover from Prisma).",
        "",
        "Muse4 uses Drizzle against PostgreSQL — set DATABASE_URL (or POSTGRES_URL, etc.)",
        "to postgresql://… from Supabase Dashboard → Database → Connection string.",
      ].join("\n"),
    );
  }
  const hasPgProto = /^postgres(ql)?:\/\//iu.test(connectionString);
  const afterProto = hasPgProto ?
    connectionString.replace(/^postgres(ql)?:\/\//iu, "")
  : connectionString;
  if (!hasPgProto || afterProto.length < 10) {
    throw new Error(
      [
        "Postgres URI is missing host, credentials, or database name.",
        "Copy the full `postgresql://…` string from Supabase (decode the password in the URI).",
      ].join("\n"),
    );
  }
}

function assertLooksLikeValidSupabasePoolerUrl(connectionString: string): void {
  if (!connectionString.includes("pooler.supabase.com")) return;

  const normalized = connectionString.replace(/^postgres(ql)?:\/\//iu, "http://");
  let u: URL;
  try {
    u = new URL(normalized);
  } catch (cause) {
    throw new Error(
      [
        "DATABASE_URL targets pooler.supabase.com but Node could not parse it as a URL.",
        "",
        "If this persists after saving, paste the Dashboard URI again — pooler URIs normally parse once credentials are percent-encoded.",
      ].join("\n"),
      { cause },
    );
  }

  const user = decodeURIComponent(u.username ?? "");
  if (!user || user === "postgres") {
    throw new Error(
      `DATABASE_URL targets the Supabase pooler, but username is "${user || "(empty)"}".\n\n` +
        `Paste the URI from Dashboard → Database → Connection string:\n` +
        `Pick **Transaction pooler** mode and copy the URI — username must look like postgres.your_project_ref (not bare "postgres").\n\n` +
        `If the password contains @ # : etc., URL-encode it in the connection string.`,
    );
  }
}

function assertNoConnectionStringPlaceholder(connectionString: string): void {
  for (const re of PLACEHOLDER_SNIPPETS) {
    if (re.test(connectionString)) {
      throw new Error(
        `DATABASE_URL still contains placeholder text (${re}).\n\n` +
          `Replace it with your real Postgres password from Supabase → Settings → Database (use “Reset database password” if you need a new one), then restart \`npm run dev\`.`,
      );
    }
  }
}

function warnIfDirectSupabaseDbHost(connectionString: string): void {
  if (!/db\.[a-z0-9]+\.supabase\.co\b/i.test(connectionString)) return;
  console.warn(
    [
      "[muse4] DATABASE_URL uses the direct db.*.supabase.co host.",
      "On many IPv4 networks this hangs until timeout.",
      "Use the Transaction pooler URI from Supabase (pooler.supabase.com, port 6543) instead.",
    ].join(" "),
  );
}

export function resolveDatabaseUrl(): string {
  for (const key of POSTGRES_URI_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw?.trim()) continue;
    const v = trimEnvConnString(raw);
    assertPostgresJdbcUrl(v);
    assertNoConnectionStringPlaceholder(v);
    const coerced = coerceParseablePostgreSqlJdbcUrl(v);
    assertLooksLikeValidSupabasePoolerUrl(coerced);
    warnIfDirectSupabaseDbHost(coerced);
    return coerced;
  }

  throw new Error(
    `Missing Postgres connection string in your environment (.env at the project root).\n\n` +
      `Add one of: ${POSTGRES_URI_ENV_KEYS.join(", ")}\n\n` +
      `Supabase: Dashboard → Settings → Database → Connection string → **URI**\n` +
      `Prefer the **Transaction pool / pooler** URL (often port \"6543\") for Next.js.\n\n` +
      `Restart \`npm run dev\` after saving.`,
  );
}
