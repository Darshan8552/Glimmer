"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const RESEND_COOLDOWN = 60;
const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const fromQuery = searchParams.get("email");
    const fromStorage = sessionStorage.getItem("resetEmail");
    const resolved = (fromQuery ?? fromStorage)?.trim().toLowerCase() ?? null;
    if (resolved) sessionStorage.setItem("resetEmail", resolved);
    return resolved;
  });
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    if (!email) { setError("Missing email address. Please request a new code."); return; }
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code sent to your email."); return; }
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setResetting(true);
    try {
      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email,
        otp: code,
        password,
      });
      if (resetError) {
        const lower = (resetError.message ?? "").toLowerCase();
        if (lower.includes("expired")) setError("That code has expired. Request a new one below.");
        else if (lower.includes("too many") || lower.includes("attempts")) setError("Too many attempts. Please request a new code.");
        else if (lower.includes("invalid")) setError("Invalid code. Please check and try again.");
        else setError(resetError.message || "Reset failed. Please try again.");
        return;
      }
      setSuccess(true);
      sessionStorage.removeItem("resetEmail");
      setTimeout(() => { router.push("/signin"); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setResetting(false); }
  }

  async function handleResend() {
    if (!email) { setError("Missing email address. Please request a new code."); return; }
    if (cooldown > 0) return;
    setError(null); setResendMessage(null); setResending(true);
    try {
      const { error: sendError } = await authClient.emailOtp.requestPasswordReset({ email });
      if (sendError) { setError(sendError.message ?? "Could not resend the code. Try again."); return; }
      setResendMessage("A new code has been sent.");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally { setResending(false); }
  }

  if (email === null) {
    return (
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card px-7 py-8 text-center shadow-sm sm:px-8">
        <h1 className="text-[18px] font-semibold tracking-tight text-card-foreground">Reset your password</h1>
        <p className="mt-2 text-[13.5px] leading-5 text-muted-foreground">We couldn&apos;t determine which email to reset.</p>
        <Link href="/forgot-password" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-[13.5px] font-medium text-primary-foreground">Request a code</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card px-7 py-10 text-center shadow-sm sm:px-8">
        <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400">✓</div>
        <h1 className="text-[18px] font-semibold text-card-foreground">Password updated</h1>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">Taking you to sign in…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card px-7 py-8 shadow-sm sm:px-8 sm:py-9">
      <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">Choose a new password</h1>
      <p className="mt-1.5 text-[13.5px] leading-5 text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 5 minutes.
      </p>

      {error && <div role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] leading-5 text-destructive">{error}</div>}
      {resendMessage && <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 px-3.5 py-2.5 text-[13px] leading-5 text-green-700 dark:text-green-300">{resendMessage}</div>}

      <form onSubmit={handleReset} noValidate className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-card-foreground">
          Verification code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            required
            className="rounded-xl border border-input bg-card px-3.5 py-3 text-center text-[22px] tracking-[0.45em] text-card-foreground placeholder:text-muted-foreground/40 placeholder:tracking-[0.45em] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-card-foreground">
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            required
            className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-card-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-card-foreground">
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            required
            className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-card-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <button type="submit" disabled={resetting} className="rounded-xl bg-primary px-4 py-3 text-[14px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
          {resetting ? "Updating…" : "Update password"}
        </button>
      </form>

      <div className="mt-5 text-center text-[13px] text-muted-foreground">
        Didn&apos;t receive a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/30 disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-[420px] rounded-2xl border border-border bg-card px-7 py-10 shadow-sm"><p className="text-center text-sm text-muted-foreground">Loading…</p></div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
