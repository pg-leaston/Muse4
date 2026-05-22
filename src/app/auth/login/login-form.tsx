"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";

export function LoginForm() {
  const router = useRouter();

  return (
    <div className="w-full max-w-md space-y-6 rounded-[28px] border border-white/12 bg-black/20 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <AuthForm onSuccess={() => router.push("/library")} />
      <p className="text-center text-sm text-white/50">
        <Link href="/library" className="hover:text-white">
          Back to library
        </Link>
      </p>
    </div>
  );
}
