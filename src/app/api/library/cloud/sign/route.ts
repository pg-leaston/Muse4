import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMuseStorageBucket } from "@/lib/supabase/storage-buckets";
import type { MuseStorageBucket } from "@/lib/supabase/storage-buckets";
import { isValidServiceRoleConfigured } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 60 * 60;

type SignItem = {
  key: string;
  bucket: MuseStorageBucket;
  path: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { items?: SignItem[] };
    const items = body.items ?? [];
    if (items.length === 0) {
      return NextResponse.json({ urls: {} });
    }
    if (items.length > 50) {
      return NextResponse.json(
        { error: "At most 50 items per sign request." },
        { status: 400 },
      );
    }

    const uid = user.id;
    const urls: Record<string, string> = {};
    const missing: string[] = [];

    /** Service role signs after we verify paths belong to this user (storage RLS often blocks client sign). */
    const storageClient: SupabaseClient<Database> =
      isValidServiceRoleConfigured() ? createAdminClient() : supabase;

    for (const item of items) {
      if (!isMuseStorageBucket(item.bucket)) {
        continue;
      }
      const path = item.path?.trim();
      if (!path || path.includes("..")) continue;
      if (!path.startsWith(`${uid}/`)) {
        return NextResponse.json(
          { error: "Invalid storage path for this user." },
          { status: 403 },
        );
      }

      const { data, error } = await storageClient.storage
        .from(item.bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);

      if (error || !data?.signedUrl) {
        const msg = error?.message ?? `Could not sign ${item.key}`;
        if (/not found/i.test(msg)) {
          missing.push(item.key);
          continue;
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      urls[item.key] = data.signedUrl;
    }

    return NextResponse.json({ urls, missing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
