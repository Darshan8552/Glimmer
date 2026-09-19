"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/chat",
      });
      if (signInError) {
        const msg = signInError.message ?? "";
        const code = (signInError as { code?: string }).code ?? "";
        const isUnverified =
          code === "EMAIL_NOT_VERIFIED" ||
          (msg.toLowerCase().includes("email") && msg.toLowerCase().includes("not verified"));
        if (isUnverified) {
          const normalizedEmail = email.trim().toLowerCase();
          await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail, type: "email-verification" });
          sessionStorage.setItem("verifyEmail", normalizedEmail);
          router.push(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}`);
          return;
        }
        setError(msg || "Sign in failed. Check your credentials.");
        return;
      }
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setOauthLoading(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/chat" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setOauthLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-2xl border border-border bg-card px-7 py-8 shadow-sm sm:px-8 sm:py-9">
        <div className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">Welcome back</h1>
          <p className="mt-1.5 text-[13.5px] leading-5 text-muted-foreground">Sign in to continue to Glimmer.</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] leading-5 text-destructive">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={oauthLoading || loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-4 py-[11px] text-[13.5px] font-medium text-card-foreground transition hover:bg-accent disabled:opacity-50"
        >
          <GoogleIcon />
          {oauthLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
          <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-card-foreground">
            <span className="flex items-center justify-between">
              Password
              <Link href="/forgot-password" className="font-normal text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                Forgot password?
              </Link>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
              className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-card-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <button
            type="submit"
            disabled={loading || oauthLoading}
            className="mt-1 rounded-xl bg-primary px-4 py-3 text-[14px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/30">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path fill="#4285F4" d="M15.1 8.18c0-.55-.05-1.08-.14-1.6H8v3.03h3.98a3.42 3.42 0 0 1-1.48 2.24v1.86h2.4c1.4-1.29 2.2-3.2 2.2-5.53z" />
      <path fill="#34A853" d="M8 15.2c1.95 0 3.58-.65 4.78-1.75l-2.4-1.86A4.3 4.3 0 0 1 8 12.3a4.5 4.5 0 0 1-4.26-3.1H1.26v1.92A7.6 7.6 0 0 0 8 15.2z" />
      <path fill="#FBBC05" d="M3.74 9.2a4.6 4.6 0 0 1-.24-1.47c0-.51.09-1 .24-1.47V4.34H1.26A7.6 7.6 0 0 0 .5 7.73c0 1.23.3 2.4.76 3.39l2.48-1.92z" />
      <path fill="#EA4335" d="M8 3.7a4.33 4.33 0 0 1 3.05 1.19l2.29-2.29A7.35 7.35 0 0 0 8 .8a7.6 7.6 0 0 0-6.74 4.14l2.48 1.92A4.5 4.5 0 0 1 8 3.7z" />
    </svg>
  );
}
