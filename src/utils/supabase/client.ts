"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";
import {
  readSupabasePublishableOrAnonKey,
  readSupabaseUrl,
} from "@/lib/supabase/env";

export function createClient() {
  const supabaseUrl = readSupabaseUrl();
  const supabaseKey = readSupabasePublishableOrAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
