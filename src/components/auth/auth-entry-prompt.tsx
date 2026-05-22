"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { useAuth } from "@/contexts/auth-context";

const SKIP_SESSION_KEY = "muse-skip-auth-prompt";

export function AuthEntryPrompt() {
  const { user, loading, isConfigured } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !isConfigured || user) {
      setOpen(false);
      return;
    }

    if (pathname.startsWith("/auth")) return;

    try {
      if (sessionStorage.getItem(SKIP_SESSION_KEY) === "1") return;
    } catch {
      /* private mode / blocked storage */
    }

    setOpen(true);
  }, [loading, isConfigured, user, pathname]);

  function dismissForSession() {
    try {
      sessionStorage.setItem(SKIP_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!isConfigured) return null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && !user) dismissForSession();
  }

  return (
    <SignInDialog
      open={open}
      onOpenChange={handleOpenChange}
      dismissLabel="Continue without signing in"
      onDismiss={dismissForSession}
    />
  );
}
