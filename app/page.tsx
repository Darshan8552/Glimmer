import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlimmerMark, Sparkle } from "@/components/glimmer-mark";
import { ThemeToggle } from "@/components/theme-toggle";

const TRUTHS = ["Three Glimmer tiers", "Streaming replies", "History, saved per account"];

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect("/chat");
  }
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,var(--accent)_0%,transparent_60%)] opacity-60 dark:opacity-[0.18]"
      />
      <header className="relative flex h-14 shrink-0 items-center justify-between px-5 sm:px-8">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
          <GlimmerMark size={28} />
          Glimmer
        </span>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <div className="flex max-w-lg flex-col items-center text-center">
          <GlimmerMark size={64} />
          <h1 className="mt-6 text-balance text-[32px] font-semibold leading-tight tracking-tight text-foreground sm:text-[38px]">
            Ask anything. Get a Glimmer of an answer.
          </h1>
          <p className="mt-3 text-pretty text-[15px] leading-6 text-muted-foreground">
            A fast chat app with three model tiers, streaming replies, and your
            conversations saved to your account.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/chat"
              className="rounded-xl bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Start chatting
            </Link>
            <Link
              href="/signin"
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-[14px] font-medium text-card-foreground transition hover:bg-accent"
            >
              Sign in
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUTHS.map((t) => (
              <li
                key={t}
                className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"
              >
                <Sparkle size={10} className="text-foreground/60" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="relative py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Glimmer
      </footer>
    </div>
  );
}
