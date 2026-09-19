"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryHttpError } from "@/components/query-provider";
import { modelLabel } from "@/ai/models";

interface AdminStats {
  totals: { users: number; conversations: number; messages: number; active7d: number };
  perModel: { model: string; n: number }[];
  recent: {
    id: string;
    title: string;
    model: string;
    updatedAt: string;
    userName: string;
    userEmail: string;
  }[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  createdAt: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit?: number;
  offset?: number;
}

const statsKey = ["admin", "stats"] as const;
const PAGE_SIZE = 20;

function usersKey(q: string, offset: number) {
  return ["admin", "users", q, offset] as const;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return (
    (data && typeof data.error === "string" && data.error) ||
    `Request failed (${res.status})`
  );
}

async function fetchStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats");
  if (!res.ok) throw new QueryHttpError(res.status, await readError(res));
  return res.json();
}

async function fetchUsers(q: string, offset: number): Promise<AdminUsersResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (q) params.set("q", q);
  const res = await fetch(`/api/admin/users?${params}`);
  if (!res.ok) throw new QueryHttpError(res.status, await readError(res));
  return res.json();
}

function modelName(model: string) {
  return modelLabel(model);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const statsQuery = useQuery({ queryKey: statsKey, queryFn: fetchStats });
  const usersQuery = useQuery({
    queryKey: usersKey(debouncedSearch, offset),
    queryFn: () => fetchUsers(debouncedSearch, offset),
  });

  const stats = statsQuery.data;
  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;

  async function runAction(body: Record<string, unknown>, key: string) {
    setActionError(null);
    setActing(key);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res));
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      await queryClient.invalidateQueries({ queryKey: statsKey });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActing(null);
    }
  }

  function handleRemove(u: AdminUser) {
    if (!window.confirm(`Delete ${u.email}? Their conversations are removed too.`)) return;
    void runAction({ action: "remove", userId: u.id }, `remove:${u.id}`);
  }

  const forbidden =
    statsQuery.error instanceof QueryHttpError && statsQuery.error.status === 403;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-4 py-3">
        <h1 className="text-[18px] font-semibold text-foreground">Admin</h1>
        <p className="text-[13px] text-muted-foreground">
          Usage, users, and recent conversations.
        </p>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 pb-8">
        {forbidden ? (
          <p role="alert" className="py-8 text-center text-[14px] text-destructive">
            Forbidden. This area is for admins only.
          </p>
        ) : statsQuery.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : statsQuery.isError ? (
          <p role="alert" className="py-4 text-[13px] text-destructive">
            Could not load stats.
          </p>
        ) : (
          stats && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Users", value: stats.totals.users },
                  { label: "Conversations", value: stats.totals.conversations },
                  { label: "Messages", value: stats.totals.messages },
                  { label: "Active (7d)", value: stats.totals.active7d },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <p className="text-[24px] font-semibold text-foreground">{c.value}</p>
                    <p className="text-[12px] text-muted-foreground">{c.label}</p>
                  </div>
                ))}
              </div>

              <h2 className="pt-6 pb-2 text-[14px] font-semibold text-foreground">
                Conversations by model
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {stats.perModel.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-muted-foreground">
                    No conversations yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {stats.perModel.map((row) => (
                      <div key={row.model} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-[13px] text-foreground">{modelName(row.model)}</span>
                        <span className="text-[13px] text-muted-foreground">{row.n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        )}

        <h2 className="pt-6 pb-2 text-[14px] font-semibold text-foreground">Users</h2>
        <div className="mb-2 flex w-full items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            aria-label="Search users"
            className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
        </div>
        {actionError && (
          <p role="alert" className="pb-2 text-[13px] text-destructive">
            {actionError}
          </p>
        )}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {usersQuery.isPending ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">Loading…</p>
          ) : usersQuery.isError ? (
            <p className="px-4 py-3 text-[13px] text-destructive">Could not load users.</p>
          ) : users.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">No users found.</p>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u) => {
                const busy = acting !== null && acting.endsWith(u.id);
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {u.name}
                        {u.role === "admin" && (
                          <span className="ml-2 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                            admin
                          </span>
                        )}
                        {u.banned && (
                          <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                            banned
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {u.email} · joined {formatDate(u.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {u.banned ? (
                        <button
                          onClick={() => runAction({ action: "unban", userId: u.id }, `unban:${u.id}`)}
                          disabled={busy}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] text-foreground transition hover:bg-accent disabled:opacity-50"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => runAction({ action: "ban", userId: u.id }, `ban:${u.id}`)}
                          disabled={busy}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          Ban
                        </button>
                      )}
                      <button
                        onClick={() =>
                          runAction(
                            { action: "set-role", userId: u.id, role: u.role === "admin" ? "user" : "admin" },
                            `role:${u.id}`
                          )
                        }
                        disabled={busy}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        {u.role === "admin" ? "Remove admin" : "Make admin"}
                      </button>
                      <button
                        onClick={() => handleRemove(u)}
                        disabled={busy}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-[13px] text-muted-foreground">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="rounded-lg border border-border px-3 py-1.5 transition hover:bg-accent disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="rounded-lg border border-border px-3 py-1.5 transition hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <h2 className="pt-6 pb-2 text-[14px] font-semibold text-foreground">
          Recent conversations
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {!stats || stats.recent.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              Nothing to show yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recent.map((c) => (
                <div key={c.id} className="px-4 py-2.5">
                  <p className="truncate text-[13px] text-foreground">{c.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {c.userEmail} · {modelName(c.model)} · {formatDate(c.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
