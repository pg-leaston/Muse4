import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";
import {
  readSupabasePublishableOrAnonKey,
  readSupabaseUrl,
} from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = readSupabaseUrl();
  const supabaseKey = readSupabasePublishableOrAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component refresh path — middleware can keep sessions in sync when you add it.
        }
      },
    },
  });
}
