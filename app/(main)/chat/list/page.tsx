"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { modelLabel } from "@/ai/models";
import {
  conversationKey,
  conversationListKey,
  conversationSearchKey,
  fetchConversationDetail,
  fetchConversations,
} from "@/lib/chat-queries";

interface SessionUser {
  name: string;
  email: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getModelBadge(model: string) {
  return modelLabel(model);
}

export default function ConversationListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const conversationsQuery = useQuery({
    queryKey: debouncedSearch ? conversationSearchKey(debouncedSearch) : conversationListKey,
    queryFn: () => fetchConversations(debouncedSearch || undefined),
  });
  const conversations = conversationsQuery.data ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        setUser({ name: data.user.name, email: data.user.email });
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

  async function handleDelete(id: string) {
    if (deleting.has(id)) return;
    const nextDeleting = new Set(deleting);
    nextDeleting.add(id);
    setDeleting(nextDeleting);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.removeQueries({ queryKey: conversationKey(id) });
        window.dispatchEvent(new Event("conversations-changed"));
      }
    } finally {
      const next = new Set(deleting);
      next.delete(id);
      setDeleting(next);
    }
  }

  async function handleTogglePin(id: string, next: boolean) {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: next }),
      });
      if (res.ok) {
        window.dispatchEvent(new Event("conversations-changed"));
      }
    } catch (e) {
      console.warn("conversations: pin toggle failed", e instanceof Error ? e.message : e);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(new Set(selectedIds));
    try {
      for (const id of selectedIds) {
        await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        queryClient.removeQueries({ queryKey: conversationKey(id) });
      }
      window.dispatchEvent(new Event("conversations-changed"));
      setSelectedIds(new Set());
    } finally {
      setDeleting(new Set());
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-[18px] font-semibold text-foreground">Conversations</h1>
            <div className="h-6 w-24 animate-pulse bg-muted rounded" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-foreground">Conversations</h1>
          <Link
            href="/chat"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </Link>
        </div>
      </div>

      <div className="px-4 pt-1">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted-foreground">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-accent/30 px-4 py-2">
          <span className="text-[13px] text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={deleting.size > 0}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[13px] font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
              Delete selected ({selectedIds.size})
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-xl px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {conversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground/50"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div>
              <h2 className="text-[16px] font-medium text-foreground">{debouncedSearch ? "No matches" : "No conversations yet"}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{debouncedSearch ? `Nothing titled like "${debouncedSearch}".` : "Start a new chat to see it here."}</p>
            </div>
            <Link
              href="/chat"
              className="mt-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Start a new chat
            </Link>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border bg-card/50">
                <div className="w-4" />
                <div className="flex-1 min-w-0">Title</div>
                <div className="w-28 text-center">Model</div>
                <div className="w-32 text-center">Updated</div>
                <div className="flex items-center gap-3">
                  <div className="w-7" />
                  <div className="w-7" />
                </div>
              </div>

              <div className="divide-y divide-border">
                {conversations.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const isDeleting = deleting.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-3 px-4 py-2.5 transition ${
                        isSelected ? "bg-accent/30" : "hover:bg-accent/20"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        disabled={isDeleting}
                      />
                      <Link
                        href={`/chat/${c.id}`}
                        onMouseEnter={() => prefetchConversation(c.id)}
                        onFocus={() => prefetchConversation(c.id)}
                        className="flex-1 min-w-0 truncate text-[13px] text-foreground hover:underline"
                        title={c.title}
                      >
                        {c.title}
                      </Link>
                      {c.isPinned && (
                        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                          Pinned
                        </span>
                      )}
                      <div className="w-28 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                          {getModelBadge(c.model)}
                        </span>
                      </div>
                      <div className="w-32 text-center text-[12px] text-muted-foreground">
                        {formatRelativeTime(c.updatedAt)}
                      </div>
                      <button
                        onClick={() => handleTogglePin(c.id, !c.isPinned)}
                        disabled={isDeleting}
                        title={c.isPinned ? "Unpin conversation" : "Pin conversation"}
                        aria-label={c.isPinned ? "Unpin conversation" : "Pin conversation"}
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-accent hover:text-foreground disabled:opacity-0 disabled:pointer-events-none ${
                          c.isPinned ? "text-foreground opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={c.isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 17v5" />
                          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={isDeleting}
                        title="Delete conversation"
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none"
                      >
                        {isDeleting ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}