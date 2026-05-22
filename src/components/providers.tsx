"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { AuthProvider } from "@/contexts/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="muse4-theme"
    >
      {children}
    </ThemeProvider>
    </AuthProvider>
  );
}
