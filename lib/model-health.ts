const HEALTH_KEY = "glimmer:model-health";
const HIDDEN_KEY = "glimmer:hidden-models";
const DOWN_AFTER_FAILURES = 2;

interface HealthEntry {
  failures: number;
  lastFailedAt: number;
}

function readMap(key: string): Record<string, HealthEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, HealthEntry>;
  } catch (e) {
    console.warn("model-health: read failed, using empty map", e instanceof Error ? e.message : e);
    return {};
  }
}

function writeMap(key: string, value: Record<string, HealthEntry>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("model-health: persist failed", e instanceof Error ? e.message : e);
  }
}

export function recordModelFailure(modelId: string) {
  const all = readMap(HEALTH_KEY);
  const prev = all[modelId]?.failures ?? 0;
  all[modelId] = { failures: prev + 1, lastFailedAt: Date.now() };
  writeMap(HEALTH_KEY, all);
}

export function recordModelSuccess(modelId: string) {
  const all = readMap(HEALTH_KEY);
  if (all[modelId]) {
    delete all[modelId];
    writeMap(HEALTH_KEY, all);
  }
}

export function isModelDown(modelId: string): boolean {
  return (readMap(HEALTH_KEY)[modelId]?.failures ?? 0) >= DOWN_AFTER_FAILURES;
}

export function getHiddenModels(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch (e) {
    console.warn("model-health: read hidden models failed", e instanceof Error ? e.message : e);
    return [];
  }
}

export function toggleHiddenModel(modelId: string): string[] {
  const current = getHiddenModels();
  const next = current.includes(modelId)
    ? current.filter((id) => id !== modelId)
    : [...current, modelId];
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("model-health: persist hidden models failed", e instanceof Error ? e.message : e);
  }
  return next;
}
