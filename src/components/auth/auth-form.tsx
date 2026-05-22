"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";

type AuthFormProps = {
  onSuccess?: () => void;
  compact?: boolean;
};

export function AuthForm({ onSuccess, compact }: AuthFormProps) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);

    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setMessage(
            "Account created. Check your email to confirm, then sign in.",
          );
          setMode("signin");
          return;
        }
        onSuccess?.();
        return;
      }

      await signIn(email, password);
      onSuccess?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Auth failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={compact ? "space-y-5" : "space-y-4"}
    >
      {!compact ?
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Your Muse account</h2>
          <p className="text-sm leading-relaxed text-white/60">
            Sign in to see songs you uploaded and play them on any device.
          </p>
        </div>
      : null}

      <div className={compact ? "space-y-2.5" : "space-y-2"}>
        <label className="text-xs font-medium text-white/70" htmlFor="auth-email">
          Email
        </label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-white/15 bg-white text-black"
        />
      </div>

      <div className={compact ? "space-y-2.5" : "space-y-2"}>
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="auth-password"
        >
          Password
        </label>
        <Input
          id="auth-password"
          type="password"
          autoComplete={
            mode === "signup" ? "new-password" : "current-password"
          }
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-white/15 bg-white text-black"
        />
      </div>

      {message ? (
        <p
          className={
            compact
              ? "rounded-lg border border-white/10 bg-white/6 px-3.5 py-3 text-sm leading-relaxed text-white/80"
              : "text-sm text-white/75"
          }
        >
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={busy}
        className="h-10 w-full bg-white text-black hover:bg-white/90"
      >
        {busy
          ? "Please wait…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </Button>

      <button
        type="button"
        className="w-full py-1 text-sm text-white/60 underline-offset-2 hover:text-white hover:underline"
        onClick={() =>
          setMode((m) => (m === "signin" ? "signup" : "signin"))
        }
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
