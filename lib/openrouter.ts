export interface OpenRouterFreeModel {
  id: string;
  name: string;
  context: number;
  free: boolean;
  inModalities: string[];
  outModalities: string[];
  tools: boolean;
}

interface CatalogCache {
  models: OpenRouterFreeModel[];
  expiresAt: number;
}

const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const CATALOG_TTL_MS = 60 * 60 * 1000;
const MAX_MODELS = 20;

const FALLBACK_FREE_MODELS: OpenRouterFreeModel[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct", context: 131072, free: true, inModalities: ["text"], outModalities: ["text"], tools: true },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B", context: 131072, free: true, inModalities: ["text"], outModalities: ["text"], tools: true },
  { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B", context: 131072, free: true, inModalities: ["text"], outModalities: ["text"], tools: true },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 0324", context: 163840, free: true, inModalities: ["text"], outModalities: ["text"], tools: true },
  { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 3.1 24B", context: 131072, free: true, inModalities: ["text", "image"], outModalities: ["text"], tools: true },
];

let catalogCache: CatalogCache | null = null;

interface OpenRouterModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string };
  architecture?: {
    input_modalities?: unknown;
    output_modalities?: unknown;
  };
  supported_parameters?: unknown;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

export async function fetchOpenRouterFreeModels(): Promise<{
  models: OpenRouterFreeModel[];
  fallback: boolean;
}> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return { models: catalogCache.models, fallback: false };
  }
  try {
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
    const data = (await res.json()) as { data?: OpenRouterModelEntry[] };
    const entries = Array.isArray(data.data) ? data.data : [];
    const models = entries
      .filter((e) => e && typeof e.id === "string" && e.pricing?.prompt === "0")
      .slice(0, MAX_MODELS)
      .map((e) => {
        const params = stringList(e.supported_parameters);
        return {
          id: e.id,
          name: typeof e.name === "string" && e.name.length > 0 ? e.name : e.id,
          context: typeof e.context_length === "number" ? e.context_length : 0,
          free: true,
          inModalities: stringList(e.architecture?.input_modalities),
          outModalities: stringList(e.architecture?.output_modalities),
          tools: params.includes("tools"),
        };
      });
    if (models.length === 0) throw new Error("No free models listed");
    catalogCache = { models, expiresAt: Date.now() + CATALOG_TTL_MS };
    return { models, fallback: false };
  } catch {
    return { models: FALLBACK_FREE_MODELS, fallback: true };
  }
}

export async function testOpenRouterKey(
  key: string
): Promise<{ valid: true; label: string } | { valid: false; error: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Key was rejected. Check it and try again." };
    }
    if (!res.ok) {
      return { valid: false, error: `OpenRouter returned ${res.status}. Try again.` };
    }
    const data = (await res.json()) as { data?: { label?: unknown } };
    const label = data?.data?.label;
    return {
      valid: true,
      label: typeof label === "string" && label.length > 0 ? label : "Unlabeled key",
    };
  } catch {
    return { valid: false, error: "Could not reach OpenRouter. Try again." };
  }
}
