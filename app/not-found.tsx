import Link from "next/link";
import { GlimmerMark } from "@/components/glimmer-mark";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl border border-border bg-card px-7 py-10 text-center shadow-sm sm:px-8">
        <GlimmerMark size={44} />
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">Page not found</h1>
          <p className="mt-1.5 text-[13.5px] leading-5 text-muted-foreground">
            This page doesn&apos;t exist or was moved.
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href="/chat"
            className="rounded-xl bg-primary px-5 py-2.5 text-[13.5px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Back to chat
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium text-foreground transition hover:bg-accent"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
