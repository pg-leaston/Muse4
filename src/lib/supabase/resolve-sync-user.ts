import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidMuseOwnerUserId,
  isValidServiceRoleConfigured,
  readMuseOwnerUserId,
} from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";
import { createClient } from "@/utils/supabase/server";

export type SyncUserContext = {
  userId: string;
  supabase: SupabaseClient<Database>;
  via: "session" | "service_role";
};

/** Prefer signed-in user; fall back to service role + MUSE_OWNER_USER_ID for CLI. */
export async function resolveSyncUserContext(): Promise<
  SyncUserContext | { error: string; status: number }
> {
  const sessionClient = await createClient();
  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();

  if (!authError && user) {
    // Admin client + signed-in user id avoids storage/RLS failures during upload.
    if (isValidServiceRoleConfigured()) {
      return {
        userId: user.id,
        supabase: createAdminClient(),
        via: "session",
      };
    }
    return { userId: user.id, supabase: sessionClient, via: "session" };
  }

  const ownerId = readMuseOwnerUserId();
  if (isValidServiceRoleConfigured() && isValidMuseOwnerUserId() && ownerId) {
    return {
      userId: ownerId,
      supabase: createAdminClient(),
      via: "service_role",
    };
  }

  return {
    error:
      "Sign in to upload and view your cloud library, or set SUPABASE_SERVICE_ROLE_KEY and MUSE_OWNER_USER_ID for CLI sync.",
    status: 401,
  };
}
