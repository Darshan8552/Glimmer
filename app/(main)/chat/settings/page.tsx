"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { redirectIfUnauthorized } from "@/lib/api-fetch";
import {
  SYSTEM_PROMPT_MAX_LENGTH,
  normalizeSystemPrompt,
} from "@/lib/settings";
import {
  PROVIDER_STALE_MS,
  fetchProviderStatus,
  providerStatusKey,
} from "@/lib/chat-queries";

type SectionId = "profile" | "customize" | "providers" | "danger";

function ProfileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

function CustomizeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2.2" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="15" cy="17" r="2.2" />
    </svg>
  );
}

function ProvidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function DangerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

const SECTIONS: { id: SectionId; label: string; icon: ReactNode; danger?: boolean }[] = [
  { id: "profile", label: "Profile", icon: <ProfileIcon /> },
  { id: "customize", label: "Customize", icon: <CustomizeIcon /> },
  { id: "providers", label: "Providers", icon: <ProvidersIcon /> },
  { id: "danger", label: "Delete account", icon: <DangerIcon />, danger: true },
];

function ProfileSection({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-[14px] font-medium text-card-foreground">Profile</h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">Your account information.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-[12px] font-medium text-muted-foreground">Name</label>
          <div className="mt-1.5 rounded-xl border border-input bg-background px-3.5 py-2.5 text-[14px] text-foreground">
            {user.name}
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium text-muted-foreground">Email</label>
          <div className="mt-1.5 rounded-xl border border-input bg-background px-3.5 py-2.5 text-[14px] text-foreground">
            {user.email}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomizeSection({
  systemPrompt,
  setSystemPrompt,
  normalizedPrompt,
  isDirty,
  isTooLong,
  spSaving,
  spSaved,
  spError,
  setSpSaved,
  setSpError,
  onSave,
}: {
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  normalizedPrompt: string;
  isDirty: boolean;
  isTooLong: boolean;
  spSaving: boolean;
  spSaved: boolean;
  spError: string | null;
  setSpSaved: (v: boolean) => void;
  setSpError: (v: string | null) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-[14px] font-medium text-card-foreground">Custom instructions</h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Added to every conversation, on all models. Leave empty to use the default.
      </p>

      <div className="mt-5">
        <label
          htmlFor="system-prompt"
          className="text-[12px] font-medium text-muted-foreground"
        >
          System prompt
        </label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => {
            setSystemPrompt(e.target.value);
            setSpSaved(false);
            setSpError(null);
          }}
          rows={4}
          maxLength={SYSTEM_PROMPT_MAX_LENGTH + 100}
          placeholder="e.g. Respond concisely. Always show code first, explanations after."
          className="mt-1.5 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-[14px] leading-6 text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-ring"
          aria-label="Custom system prompt"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p
            className={`text-[12px] ${isTooLong ? "text-destructive" : "text-muted-foreground"}`}
          >
            {normalizedPrompt.length}/{SYSTEM_PROMPT_MAX_LENGTH}
          </p>
          <div className="flex items-center gap-2">
            {spSaved && (
              <span className="text-[12px] text-muted-foreground">Saved</span>
            )}
            <button
              onClick={onSave}
              disabled={spSaving || !isDirty || isTooLong}
              className="rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {spSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {spError && (
          <p className="mt-2 text-[12px] text-destructive">{spError}</p>
        )}
      </div>
    </div>
  );
}

export interface ProviderStatus {
  provider: string;
  connected: boolean;
  masked: string | null;
  length: number | null;
}

function displayMask(status: ProviderStatus | null): string {
  if (!status?.connected || !status.masked) return "";
  const tail = status.masked.slice(-4);
  const len =
    typeof status.length === "number" && status.length > 4 ? status.length : 8;
  return "•".repeat(len - 4) + tail;
}

interface ProviderCardConfig {
  provider: string;
  label: string;
  placeholder: string;
}

export const PROVIDER_CARDS: ProviderCardConfig[] = [
  {
    provider: "openrouter",
    label: "OpenRouter",
    placeholder: "sk-or-v1-…",
  },
  {
    provider: "groq",
    label: "Groq",
    placeholder: "gsk_…",
  },
];

async function postJSON(url: string, body: Record<string, unknown>, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        `Request failed (${res.status})`
    );
  }
  return data;
}

export function ProviderCard({
  config,
  status,
  onStatus,
}: {
  config: ProviderCardConfig;
  status: ProviderStatus | null;
  onStatus: (s: ProviderStatus) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | "delete" | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!confirmingDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingDelete(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmingDelete]);

  const maskShown = displayMask(status);

  useEffect(() => {
    if (maskShown !== "") {
      Promise.resolve().then(() => {
        setKeyInput((prev) => (prev === "" ? maskShown : prev));
      });
    }
  }, [maskShown]);

  const showingMasked =
    status?.connected === true &&
    !revealed &&
    keyInput !== "" &&
    keyInput === displayMask(status);
  const isUnchanged =
    showingMasked || (revealed && revealedKey !== null && keyInput === revealedKey);

  function focusInputEnd() {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  async function handleToggleReveal() {
    if (revealing || busy) return;
    if (revealed) {
      setKeyInput(displayMask(status));
      setRevealed(false);
      setRevealedKey(null);
      focusInputEnd();
      return;
    }
    setRevealing(true);
    try {
      const data = await postJSON("/api/providers/reveal", {
        provider: config.provider,
      });
      if (typeof data.key !== "string" || data.key.length === 0) {
        throw new Error("Could not load key.");
      }
      setKeyInput(data.key);
      setRevealed(true);
      setRevealedKey(data.key);
      focusInputEnd();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load key.");
    } finally {
      setRevealing(false);
    }
  }

  async function handleCopy() {
    if (copying || busy) return;
    if (!status?.connected) return;
    setCopying(true);
    try {
      const plain = revealed
        ? keyInput
        : (await postJSON("/api/providers/reveal", {
            provider: config.provider,
          })).key;
      if (typeof plain !== "string" || plain.length === 0) {
        throw new Error("Could not load key.");
      }
      await navigator.clipboard.writeText(plain);
      toast.success("Key copied to clipboard.");
    } catch {
      toast.error("Could not copy key.");
    } finally {
      setCopying(false);
    }
  }

  async function handleTest() {
    if (busy || revealing || copying || keyInput.trim().length === 0 || isUnchanged) return;
    setBusy("test");
    try {
      const data = await postJSON("/api/providers/test", {
        provider: config.provider,
        key: keyInput.trim(),
      });
      const label = typeof data.label === "string" ? ` (${data.label})` : "";
      toast.success(`Key is valid${label}. Save it to use.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (busy || revealing || copying || keyInput.trim().length === 0 || isUnchanged) return;
    setBusy("save");
    try {
      const data = await postJSON("/api/providers", {
        provider: config.provider,
        key: keyInput.trim(),
      });
      onStatus({
        provider: config.provider,
        connected: true,
        masked: data.masked ?? null,
        length: typeof data.length === "number" ? data.length : null,
      });
      setKeyInput(
        displayMask({
          provider: config.provider,
          connected: true,
          masked: data.masked ?? null,
          length: typeof data.length === "number" ? data.length : null,
        })
      );
      setRevealed(false);
      setRevealedKey(null);
      toast.success("Key saved.");
      void queryClient.invalidateQueries({ queryKey: ["providers", "models"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (busy || revealing || copying) return;
    setBusy("delete");
    try {
      await postJSON("/api/providers", { provider: config.provider }, "DELETE");
      onStatus({ provider: config.provider, connected: false, masked: null, length: null });
      setKeyInput("");
      setRevealed(false);
      setRevealedKey(null);
      toast.success("API key removed.");
      void queryClient.invalidateQueries({ queryKey: ["providers", "models"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-background p-4 first:mt-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-foreground">{config.label}</p>
        {!status ? (
          <span className="text-[12px] text-muted-foreground">Loading…</span>
        ) : status.connected ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            Connected{status.masked ? ` ${status.masked}` : ""}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
            Not connected
          </span>
        )}
      </div>

      <label
        htmlFor={`${config.provider}-key`}
        className="mt-3 block text-[12px] font-medium text-muted-foreground"
      >
        API key
      </label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id={`${config.provider}-key`}
              ref={inputRef}
              type={revealed ? "text" : "password"}
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setRevealed(false);
              }}
              placeholder={status?.connected ? "Enter a new key to replace…" : config.placeholder}
              autoComplete="off"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 pr-11 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-ring"
            />
            {status?.connected && (
              <button
                onClick={handleToggleReveal}
                disabled={revealing || busy !== null}
                title={revealed ? "Hide key" : "Show key"}
                aria-label={revealed ? "Hide key" : "Show key"}
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                {revealed ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94" />
                    <path d="M9.9 4.24A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            )}
          </div>
          {status?.connected && (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null || revealing || copying}
              title="Remove key"
              aria-label="Remove key"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            >
              {busy === "delete" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              )}
            </button>
          )}
        </div>
        {status?.connected && (
          <button
            onClick={handleCopy}
            disabled={copying || busy !== null}
            className="mt-2 text-[12px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            {copying ? "Copying…" : "Copy API key"}
          </button>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={busy !== null || revealing || copying || keyInput.trim().length === 0 || isUnchanged}
            className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "test" ? "Testing…" : "Test"}
          </button>
          <button
            onClick={handleSave}
            disabled={busy !== null || revealing || copying || keyInput.trim().length === 0 || isUnchanged}
            className="rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmingDelete(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Remove ${config.label} key`}
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg"
          >
            <h3 className="text-[14px] font-semibold text-foreground">
              Remove {config.label} key?
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              This disconnects {config.label} models from the picker. You can add
              the key back anytime.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={busy !== null}
                className="rounded-xl px-4 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy !== null}
                className="rounded-xl bg-destructive px-4 py-2 text-[13px] font-medium text-white transition hover:bg-destructive/90 disabled:opacity-40"
              >
                {busy === "delete" ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}

function ProvidersSection() {
  const router = useRouter();
  const statusQuery = useQuery({
    queryKey: providerStatusKey,
    queryFn: fetchProviderStatus,
    staleTime: PROVIDER_STALE_MS,
  });
  const statuses = statusQuery.data ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-[14px] font-medium text-card-foreground">Providers</h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Bring your own API keys. Select a provider to connect.
      </p>

      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {PROVIDER_CARDS.map((config) => {
          const status = (statuses ?? []).find((s) => s.provider === config.provider);
          return (
            <div key={config.provider} className="flex items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{config.label}</p>
                <p className="text-[12px] text-muted-foreground">
                  {!statuses
                    ? "Loading…"
                    : status?.connected
                      ? `Connected${status.masked ? ` ${status.masked}` : ""}`
                      : "Not connected"}
                </p>
              </div>
              {status?.connected ? (
                <>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                    Connected
                  </span>
                  <button
                    onClick={() => router.push(`/providers/${config.provider}`)}
                    title={`Open ${config.label}`}
                    aria-label={`Open ${config.label}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push(`/providers/${config.provider}`)}
                  className="shrink-0 rounded-xl border border-border px-4 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-accent"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DangerSection() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await authClient.deleteUser();
      if (deleteError) {
        throw new Error(deleteError.message || "Could not delete your account.");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-5">
      <h2 className="text-[14px] font-medium text-destructive">Danger zone</h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">Irreversible actions.</p>
      {confirming && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          This permanently deletes your account and all conversations. Click again to confirm.
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-xl border border-destructive/30 px-4 py-2 text-[13px] font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? "Deleting…" : confirming ? "Click again to confirm" : "Delete account"}
        </button>
        {confirming && !deleting && (
          <button
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            className="rounded-xl px-4 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionId>("profile");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState<string | null>(null);
  const [spSaving, setSpSaving] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);
  const [spSaved, setSpSaved] = useState(false);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        setUser({ name: data.user.name, email: data.user.email });
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPrompt() {
      try {
        const res = await fetch("/api/settings");
        if (redirectIfUnauthorized(res, router)) {
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.systemPrompt === "string") {
          setSystemPrompt(data.systemPrompt);
          setSavedPrompt(normalizeSystemPrompt(data.systemPrompt));
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("settings: load instructions failed", e instanceof Error ? e.message : e);
          setSpError("Could not load saved instructions.");
        }
      }
    }
    loadPrompt();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const normalizedPrompt = normalizeSystemPrompt(systemPrompt);
  const isDirty = savedPrompt !== null && normalizedPrompt !== savedPrompt;
  const isTooLong = normalizedPrompt.length > SYSTEM_PROMPT_MAX_LENGTH;

  async function handleSavePrompt() {
    if (spSaving || isTooLong || !isDirty) return;
    setSpSaving(true);
    setSpError(null);
    setSpSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      if (redirectIfUnauthorized(res, router)) {
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      const saved = normalizeSystemPrompt(
        typeof data?.systemPrompt === "string" ? data.systemPrompt : systemPrompt
      );
      setSystemPrompt(saved);
      setSavedPrompt(saved);
      setSpSaved(true);
    } catch (e) {
      setSpError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSpSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  function navButtonClass(id: SectionId, danger?: boolean) {
    const active = section === id;
    if (danger) {
      return active
        ? "bg-destructive/10 text-destructive"
        : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive";
    }
    return active
      ? "bg-accent text-foreground font-medium"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground";
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-[20px] font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Manage your account settings.</p>

        <div className="mt-6 flex gap-1 overflow-x-auto sm:hidden" role="tablist" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[13px] transition ${navButtonClass(s.id, s.danger)}`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:mt-8 sm:flex-row">
          <nav className="hidden w-48 shrink-0 sm:block" aria-label="Settings sections">
            <div className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  aria-current={section === s.id ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition ${navButtonClass(s.id, s.danger)}`}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            {section === "profile" && <ProfileSection user={user} />}
            {section === "customize" && (
              <CustomizeSection
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                normalizedPrompt={normalizedPrompt}
                isDirty={isDirty}
                isTooLong={isTooLong}
                spSaving={spSaving}
                spSaved={spSaved}
                spError={spError}
                setSpSaved={setSpSaved}
                setSpError={setSpError}
                onSave={handleSavePrompt}
              />
            )}
            {section === "providers" && <ProvidersSection />}
            {section === "danger" && <DangerSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
