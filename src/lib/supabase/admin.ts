import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  readSupabaseServiceRoleKey,
  readSupabaseUrl,
} from "@/lib/supabase/env";

export function createAdminClient() {
  const url = readSupabaseUrl();
  const serviceRoleKey = readSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server sync.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
