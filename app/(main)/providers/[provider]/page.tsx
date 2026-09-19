"use client";

import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryHttpError } from "@/components/query-provider";
import { toast } from "sonner";
import { BYOK_PROVIDERS, type ByokProvider } from "@/ai/models";
import {
  PROVIDER_STALE_MS,
  fetchByokModels,
  fetchProviderStatus,
  providerModelsKey,
  providerStatusKey,
} from "@/lib/chat-queries";
import {
  isModelDown,
  recordModelFailure,
  recordModelSuccess,
} from "@/lib/model-health";
import {
  addRegistryModel,
  importCatalogModels,
  readRegistry,
  removeRegistryModel,
  restoreRegistryModel,
  type CatalogSpec,
  type RegistryModel,
  type RegistryState,
} from "@/lib/model-registry";
import {
  PROVIDER_CARDS,
  ProviderCard,
  type ProviderStatus,
} from "@/app/(main)/chat/settings/page";

interface TestResult {
  ok: boolean;
  ms?: number;
  error?: string;
}

type ModelsTab = "all" | "removed" | "free";

const PROVIDER_IDS = Object.keys(BYOK_PROVIDERS) as ByokProvider[];

const FEATURES: Record<ByokProvider, { specs: boolean; freeTab: boolean; freeToggle: boolean }> = {
  openrouter: { specs: true, freeTab: true, freeToggle: true },
  groq: { specs: false, freeTab: false, freeToggle: false },
};

function compactContext(n: number): string | null {
  if (!n || n <= 0) return null;
  return n >= 1024 ? `${Math.round(n / 1024)}k` : `${n}`;
}

function SpecChips({ m }: { m: RegistryModel }) {
  const chips: string[] = [];
  if (m.free === true) chips.push("Free");
  const extraIn = m.inModalities
    .filter((x) => x !== "text")
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  if (extraIn.length > 0) chips.push(`${extraIn.join(" + ")} in`);
  const extraOut = m.outModalities.filter((x) => x !== "text");
  if (extraOut.length > 0) chips.push(`Generates ${extraOut.join(", ")}`);
  if (m.tools === true) chips.push("Tools");
  const ctx = compactContext(m.context);
  if (ctx) chips.push(ctx);
  if (m.custom) chips.push("Custom");
  if (chips.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full border border-border bg-background px-1.5 py-px text-[10px] text-muted-foreground"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export default function ProviderPage() {
  const { provider } = useParams<{ provider: string }>();
  const router = useRouter();
  if (!PROVIDER_IDS.includes(provider as ByokProvider)) notFound();
  const providerId = provider as ByokProvider;
  const info = BYOK_PROVIDERS[providerId];
  const cardConfig =
    PROVIDER_CARDS.find((c) => c.provider === providerId) ?? PROVIDER_CARDS[0];

  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: providerStatusKey,
    queryFn: fetchProviderStatus,
    staleTime: PROVIDER_STALE_MS,
  });
  const modelsQuery = useQuery({
    queryKey: providerModelsKey(providerId),
    queryFn: () => fetchByokModels(providerId),
    staleTime: PROVIDER_STALE_MS,
  });
  const status: ProviderStatus | null = (() => {
    const found = statusQuery.data?.find((s) => s.provider === providerId);
    if (!found) return null;
    return {
      provider: found.provider,
      connected: found.connected,
      masked: found.masked ?? null,
      length: found.length ?? null,
    };
  })();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ModelsTab>("all");
  const [testing, setTesting] = useState<string | null>(null);
  const [testAll, setTestAll] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [registry, setRegistry] = useState<RegistryState>(() => readRegistry(providerId));
  const [freeOnly, setFreeOnly] = useState(true);
  const [manualId, setManualId] = useState("");
  const features = FEATURES[providerId];

  const catalog: CatalogSpec[] = (modelsQuery.data ?? []).map((o) => ({
    id: o.id.replace(/^[a-z]+:/, ""),
    name: o.name,
    context: o.context ?? 0,
    free: o.free ?? null,
    inModalities: o.inModalities ?? [],
    outModalities: o.outModalities ?? [],
    tools: o.tools ?? null,
  }));
  const catalogReady = !modelsQuery.isPending && !modelsQuery.isError && catalog.length > 0;
  const loading = statusQuery.isPending || modelsQuery.isPending;
  const modelsError = modelsQuery.error;

  useEffect(() => {
    if (
      modelsError instanceof QueryHttpError &&
      modelsError.status === 401
    ) {
      router.push("/signin");
    }
  }, [modelsError, router]);

  function handleStatus(next: ProviderStatus) {
    queryClient.setQueryData(providerStatusKey, (prev) => {
      const list = (prev ?? []) as { provider: string; connected: boolean }[];
      const rest = list.filter((s) => s.provider !== next.provider);
      return [
        ...rest,
        {
          provider: next.provider,
          connected: next.connected,
          masked: next.masked,
          length: next.length,
        },
      ];
    });
    void queryClient.invalidateQueries({ queryKey: ["providers", "models"] });
  }

  function fullId(slug: string) {
    return `${providerId}:${slug}`;
  }

  async function runTest(m: RegistryModel): Promise<boolean> {
    try {
      const res = await fetch("/api/providers/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          model: m.id,
          ...(m.custom ? { custom: true } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            `Request failed (${res.status})`
        );
      }
      recordModelSuccess(fullId(m.id));
      setResults((prev) => ({ ...prev, [m.id]: { ok: true, ms: data.ms } }));
      return true;
    } catch (e) {
      recordModelFailure(fullId(m.id));
      setResults((prev) => ({
        ...prev,
        [m.id]: {
          ok: false,
          error: e instanceof Error ? e.message : "Test failed.",
        },
      }));
      return false;
    }
  }

  async function handleTestModel(m: RegistryModel) {
    if (testing || testAll) return;
    setTesting(m.id);
    try {
      await runTest(m);
    } finally {
      setTesting(null);
    }
  }

  async function handleTestAll() {
    if (testing || testAll) return;
    const targets = registry.imported.filter(
      (m) => !registry.removed.includes(m.id)
    );
    if (targets.length === 0) return;
    setTestAll({ done: 0, total: targets.length });
    let ok = 0;
    let done = 0;
    for (const m of targets) {
      if (await runTest(m)) ok++;
      done++;
      setTestAll({ done, total: targets.length });
    }
    setTestAll(null);
    toast.success(`${ok} of ${targets.length} models work.`);
  }

  function handleImport() {
    if (catalog.length === 0) return;
    const before = registry.imported.length;
    const next = importCatalogModels(
      providerId,
      catalog,
      features.freeToggle ? freeOnly : false
    );
    setRegistry(next);
    const added = next.imported.length - before;
    toast.success(
      added > 0
        ? `Imported ${added} model${added === 1 ? "" : "s"}.`
        : "Already up to date."
    );
  }

  function handleManualAdd() {
    const raw = manualId.trim();
    if (!raw) return;
    const slug = raw.replace(/^(openrouter|groq):/, "");
    if (!slug) {
      toast.error("Enter a model id.");
      return;
    }
    const known = catalog.find((c) => c.id === slug);
    const { state, duplicate } = addRegistryModel(providerId, {
      ...(known ?? {
        id: slug,
        name: slug,
        context: 0,
        free: null,
        inModalities: [],
        outModalities: [],
        tools: null,
      }),
      custom: !known,
    });
    setRegistry(state);
    if (duplicate) {
      toast.error("Already in your list.");
    } else if (known) {
      toast.success(`Added ${slug}.`);
      setManualId("");
    } else {
      toast.success("Added as custom — Test will verify it.");
      setManualId("");
    }
  }

  function handleRemove(slug: string) {
    setRegistry(removeRegistryModel(providerId, slug));
  }

  function handleRestore(slug: string) {
    setRegistry(restoreRegistryModel(providerId, slug));
  }

  const q = search.trim().toLowerCase();
  const visible = registry.imported.filter((m) => {
    const removed = registry.removed.includes(m.id);
    if (tab === "removed") {
      if (!removed) return false;
    } else {
      if (removed) return false;
      if (tab === "free" && m.free !== true) return false;
    }
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
  });
  const removedCount = registry.removed.length;
  const tabs: ModelsTab[] = features.freeTab
    ? ["all", "removed", "free"]
    : ["all", "removed"];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href="/chat/settings"
          className="mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Settings
        </Link>

        <h1 className="text-[20px] font-semibold text-foreground">{info.label}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Manage your key and models.
        </p>

        <ProviderCard config={cardConfig} status={status} onStatus={handleStatus} />

        <div className="mt-8">
          <h2 className="text-[14px] font-semibold text-foreground">Models</h2>

          <div className="mt-2 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              {features.freeToggle && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={freeOnly}
                    onChange={(e) => setFreeOnly(e.target.checked)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  Import free models only
                </label>
              )}
              <button
                onClick={handleImport}
                disabled={!catalogReady}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Import{registry.imported.length > 0 ? ` (${registry.imported.length})` : ""}
              </button>
              {!catalogReady && !loading && (
                <span className="text-[12px] text-muted-foreground">
                  {providerId === "groq" && !status?.connected
                    ? "Connect your key above to import."
                    : "Catalog unavailable right now."}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualAdd();
                }}
                placeholder="Paste a model id, e.g. inclusionai/ling-3.0-flash-vl:free"
                aria-label="Add a model by id"
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-ring"
              />
              <button
                onClick={handleManualAdd}
                disabled={manualId.trim().length === 0}
                className="shrink-0 rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 sm:max-w-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted-foreground">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models…"
                aria-label="Search models"
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-xl border border-border text-[13px]">
                {tabs.map((t) => {
                  const active = tab === t;
                  const label =
                    t === "removed" ? `Removed (${removedCount})` : t === "free" ? "Free" : "All";
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      aria-pressed={active}
                      className={`px-3.5 py-1.5 capitalize transition ${
                        active
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleTestAll}
                disabled={testing !== null || testAll !== null || registry.imported.length === 0}
                title="Test every imported model, one by one"
                className="shrink-0 rounded-xl border border-border px-3.5 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
              >
                {testAll ? `Testing ${testAll.done}/${testAll.total}…` : "Test All"}
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            {visible.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">
                {registry.imported.length === 0
                  ? "Nothing here yet — import or add models above."
                  : "No matches."}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {visible.map((m) => {
                  const result = results[m.id];
                  const removed = registry.removed.includes(m.id);
                  const busy = testing === m.id;
                  return (
                    <div key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {m.name}
                          {isModelDown(fullId(m.id)) && (
                            <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-px text-[10px] font-normal text-destructive">
                              may be down
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {m.id}
                        </p>
                        {features.specs && <SpecChips m={m} />}
                        {result && (
                          <p className={`mt-0.5 truncate text-[12px] ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
                            {result.ok
                              ? `Works${typeof result.ms === "number" ? ` · ${result.ms}ms` : ""}`
                              : result.error}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => handleTestModel(m)}
                          disabled={busy || testing !== null || testAll !== null}
                          title="Test"
                          aria-label={`Test ${m.name}`}
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          {busy ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="6 3 20 12 6 21 6 3" />
                            </svg>
                          )}
                        </button>
                        {removed ? (
                          <button
                            onClick={() => handleRestore(m.id)}
                            className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-foreground transition hover:bg-accent"
                          >
                            Add
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRemove(m.id)}
                            title="Remove"
                            aria-label={`Remove ${m.name}`}
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M5 12h14" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
