"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const { error: requestError } = await authClient.emailOtp.requestPasswordReset({
        email: normalized,
      });
      if (requestError) {
        setError(requestError.message ?? "Could not send the code. Try again.");
        return;
      }
      sessionStorage.setItem("resetEmail", normalized);
      router.push(`/reset-password?email=${encodeURIComponent(normalized)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card px-7 py-8 shadow-sm sm:px-8 sm:py-9">
      <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">Reset your password</h1>
      <p className="mt-1.5 text-[13.5px] leading-5 text-muted-foreground">
        Enter your account email and we&apos;ll send you a 6-digit code. It expires in 5 minutes.
      </p>

      {error && <div role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] leading-5 text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-card-foreground">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@glimmer.app"
            autoComplete="email"
            required
            className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-card-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <button type="submit" disabled={sending} className="rounded-xl bg-primary px-4 py-3 text-[14px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
          {sending ? "Sending…" : "Send reset code"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Remembered it?{" "}
        <Link href="/signin" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/30">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
