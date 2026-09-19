"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        callbackURL: "/chat",
      });
      if (signUpError) {
        setError(signUpError.message ?? "Sign up failed. Please try again.");
        return;
      }
      sessionStorage.setItem("verifyEmail", email.trim().toLowerCase());
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`);
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
          <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">
            Create your account
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-5 text-muted-foreground">
            Welcome to Glimmer — let&apos;s get you set up.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] leading-5 text-destructive"
          >
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
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
              required
              className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-card-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
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
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              minLength={8}
              className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-card-foreground placeholder:text-muted-foreground/60 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <button
            type="submit"
            disabled={loading || oauthLoading}
            className="mt-1 rounded-xl bg-primary px-4 py-3 text-[14px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/30">
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-6 px-2 text-center text-[11.5px] leading-4 text-muted-foreground">
        By continuing you agree to our Terms and Privacy Policy.
      </p>
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
