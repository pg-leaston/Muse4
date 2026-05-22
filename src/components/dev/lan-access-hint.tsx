"use client";

import { useEffect, useState } from "react";

/** Shown in dev when opened from a LAN IP so you can open the same URL on your phone. */
export function LanAccessHint() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    setUrl(`${window.location.protocol}//${host}:${window.location.port}/library`);
  }, []);

  if (!url) return null;

  return (
    <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/90">
      On your phone (same Wi‑Fi), open{" "}
      <a href={url} className="font-medium text-white underline">
        {url}
      </a>
      , sign in with the same account, then use the <strong>Cloud</strong> tab.
    </p>
  );
}
