import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,var(--accent)_0%,transparent_60%)] opacity-60 dark:opacity-[0.18]"
      />
      <header className="relative flex h-14 shrink-0 items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground"
        >
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-[11px] font-bold tracking-widest">
            G
          </span>
          Glimmer
        </Link>
        <ThemeToggle />
      </header>
      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:py-12">
        {children}
      </div>
      <footer className="relative py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Glimmer
      </footer>
    </div>
  );
}
