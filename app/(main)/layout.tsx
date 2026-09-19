"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient, signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlimmerMark } from "@/components/glimmer-mark";
import {
  conversationKey,
  conversationListKey,
  fetchConversationDetail,
  fetchConversations,
  type ConversationListItem,
} from "@/lib/chat-queries";

interface SessionUser {
  name: string;
  email: string;
  role?: string;
}

const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_WIDTH_KEY = "glimmer:sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "glimmer:sidebar-collapsed";

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

function persistSidebarPref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.warn("sidebar: persist pref failed", e instanceof Error ? e.message : e);
  }
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
  try {
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(saved)) return clampSidebarWidth(saved);
  } catch (e) {
    console.warn("sidebar: read width failed", e instanceof Error ? e.message : e);
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch (e) {
    console.warn("sidebar: read collapsed failed", e instanceof Error ? e.message : e);
    return false;
  }
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const queryClient = useQueryClient();
  const conversationsQuery = useQuery({
    queryKey: conversationListKey,
    queryFn: () => fetchConversations(),
  });
  const conversations = conversationsQuery.data ?? [];
  const trimmedFilter = sidebarFilter.trim().toLowerCase();
  const visibleConversations = trimmedFilter
    ? conversations.filter((c) => c.title.toLowerCase().includes(trimmedFilter))
    : conversations;
  const pinned = conversations.filter((c) => c.isPinned);
  const unpinned = conversations.filter((c) => !c.isPinned);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [desktopCollapsed, setDesktopCollapsed] = useState(readSidebarCollapsed);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        setUser({
          name: data.user.name,
          email: data.user.email,
          role: (data.user as { role?: string }).role,
        });
      } else {
        router.push("/signin");
      }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    function onChanged() {
      queryClient.invalidateQueries({ queryKey: conversationListKey });
    }
    window.addEventListener("conversations-changed", onChanged);
    return () => {
      window.removeEventListener("conversations-changed", onChanged);
    };
  }, [queryClient]);

  function prefetchConversation(id: string) {
    queryClient.prefetchQuery({
      queryKey: conversationKey(id),
      queryFn: () => fetchConversationDetail(id),
    });
  }

  async function handleDeleteConversation(id: string) {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      queryClient.removeQueries({ queryKey: conversationKey(id) });
      window.dispatchEvent(new Event("conversations-changed"));
      if (pathname === `/chat/${id}`) router.push("/chat");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete conversation.");
    }
  }

  async function handleTogglePin(id: string, next: boolean) {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      window.dispatchEvent(new Event("conversations-changed"));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not update conversation.");
    }
  }

  function conversationRow(c: ConversationListItem) {
    const active = pathname === `/chat/${c.id}`;
    return (
      <div
        key={c.id}
        className={`group flex items-center gap-1 rounded-lg border pr-1 transition ${
          active
            ? "border-sidebar-border bg-sidebar-accent"
            : "border-transparent hover:bg-sidebar-accent/60"
        }`}
      >
        <Link
          href={`/chat/${c.id}`}
          onMouseEnter={() => prefetchConversation(c.id)}
          onFocus={() => prefetchConversation(c.id)}
          className="min-w-0 flex-1 truncate px-2.5 py-2 text-[13px] text-sidebar-foreground"
          title={c.title}
        >
          {c.title}
        </Link>
        <button
          onClick={() => handleTogglePin(c.id, !c.isPinned)}
          title={c.isPinned ? "Unpin conversation" : "Pin conversation"}
          aria-label={c.isPinned ? "Unpin conversation" : "Pin conversation"}
          className={`flex size-6 shrink-0 items-center justify-center rounded-lg transition hover:bg-sidebar-accent hover:text-foreground ${
            c.isPinned
              ? "text-foreground opacity-100"
              : "text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={c.isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
          </svg>
        </button>
        <button
          onClick={() => handleDeleteConversation(c.id)}
          title="Delete conversation"
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    );
  }

  function collapseSidebar() {
    setDesktopCollapsed(true);
    persistSidebarPref(SIDEBAR_COLLAPSED_KEY, "1");
  }

  function expandSidebar() {
    setDesktopCollapsed(false);
    persistSidebarPref(SIDEBAR_COLLAPSED_KEY, "0");
  }

  function nudgeSidebarWidth(delta: number) {
    setSidebarWidth((prev) => {
      const next = clampSidebarWidth(prev + delta);
      persistSidebarPref(SIDEBAR_WIDTH_KEY, String(next));
      return next;
    });
  }
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return null;

  const hideSidebar = pathname === "/chat/settings" || pathname.startsWith("/providers/");
  if (hideSidebar) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.push("/signin");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        style={{ width: sidebarWidth }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setSidebarOpen(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:static lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopCollapsed ? "lg:hidden" : ""}`}
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <Link
            href="/chat"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1"
            title="Glimmer home"
          >
            <GlimmerMark size={24} />
            <span className="truncate text-[14px] font-semibold text-sidebar-foreground">
              Glimmer
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
            aria-label="Close sidebar"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={collapseSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="hidden size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground lg:flex"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9-2 3 2 3" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 pt-2 pb-4">
          <Link
            href="/chat"
            className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent px-3 text-[13px] font-medium text-sidebar-foreground transition hover:bg-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </Link>
        </div>

        {user.role === "admin" && (
          <div className="flex items-center gap-2 px-3 pb-2">
            <Link
              href="/admin"
              className="flex h-9 flex-1 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
                <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
              Admin
            </Link>
          </div>
        )}

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragState.current = { startX: e.clientX, startWidth: sidebarWidth };
          }}
          onPointerMove={(e) => {
            const drag = dragState.current;
            if (!drag) return;
            setSidebarWidth(clampSidebarWidth(drag.startWidth + e.clientX - drag.startX));
          }}
          onPointerUp={() => {
            if (!dragState.current) return;
            dragState.current = null;
            persistSidebarPref(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
          }}
          onPointerCancel={() => {
            dragState.current = null;
          }}
          onDoubleClick={() => {
            setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
            persistSidebarPref(SIDEBAR_WIDTH_KEY, String(SIDEBAR_DEFAULT_WIDTH));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              nudgeSidebarWidth(-10);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              nudgeSidebarWidth(10);
            }
          }}
          className="absolute top-0 right-0 hidden h-full w-1.5 cursor-ew-resize touch-none transition hover:bg-ring/60 focus-visible:bg-ring/60 lg:block"
        />

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <Link
            href="/chat/list"
            className="flex items-center justify-between px-1 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition"
          >
            <span>Recent Chat</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <div className="border-t border-sidebar-border my-1" />
          <input
            type="search"
            value={sidebarFilter}
            onChange={(e) => setSidebarFilter(e.target.value)}
            placeholder="Filter chats…"
            aria-label="Filter conversations"
            className="mb-2 mt-1 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-1.5 text-[12px] text-sidebar-foreground placeholder:text-muted-foreground/60 outline-none transition focus:bg-sidebar-accent"
          />
          {deleteError && (
            <p role="alert" className="px-1 py-1.5 text-[12px] text-destructive">
              {deleteError}
            </p>
          )}
          {visibleConversations.length === 0 ? (
            <p className="px-1 py-3 text-[12px] text-muted-foreground">{trimmedFilter ? "No matches" : "No conversations yet"}</p>
          ) : trimmedFilter ? (
            <div className="flex flex-col gap-0.5">
              {visibleConversations.map(conversationRow)}
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <p className="px-1 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pinned</p>
                  <div className="flex flex-col gap-0.5">
                    {pinned.map(conversationRow)}
                  </div>
                </>
              )}
              {pinned.length > 0 && (
                <p className="px-1 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recent</p>
              )}
              {unpinned.length === 0 ? (
                <p className="px-1 py-3 text-[12px] text-muted-foreground">No recent chats</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {unpinned.map(conversationRow)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="relative border-t border-sidebar-border p-3">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-sidebar-accent"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-foreground">
              {user.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">{user.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`shrink-0 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-3 right-3 z-50 mb-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                <div className="border-b border-border px-3.5 py-2.5">
                  <p className="text-[13px] font-medium text-foreground">{user.name}</p>
                  <p className="text-[12px] text-muted-foreground">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/chat/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground transition hover:bg-accent"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Settings
                  </Link>
                  <div className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-[13px] text-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); handleSignOut(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-destructive transition hover:bg-destructive/10"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {desktopCollapsed && (
          <div className="hidden h-12 shrink-0 items-center gap-3 border-b border-border px-4 lg:flex">
            <button
              onClick={expandSidebar}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                <path d="m12 9 2 3-2 3" />
              </svg>
            </button>
            <span className="text-[14px] font-semibold text-foreground">Glimmer</span>
          </div>
        )}
        <header className="flex h-12 items-center gap-3 border-b border-border px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            aria-label="Open sidebar"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="text-[14px] font-semibold text-foreground">Glimmer</span>
        </header>

        {children}
      </div>
    </div>
  );
}
