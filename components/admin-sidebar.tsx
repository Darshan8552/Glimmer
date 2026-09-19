"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlimmerMark } from "./glimmer-mark";

interface AdminNavItem {
  href: string;
  label: string;
}

const ADMIN_NAV: AdminNavItem[] = [{ href: "/admin", label: "Overview" }];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <GlimmerMark size={24} />
        <span className="text-[14px] font-semibold text-sidebar-foreground">
          Admin
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {ADMIN_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back to chat
        </Link>
      </div>
    </aside>
  );
}
