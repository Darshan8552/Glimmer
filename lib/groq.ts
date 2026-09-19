export interface GroqModel {
  id: string;
  name: string;
  context: number;
}

interface ModelsCache {
  models: GroqModel[];
  expiresAt: number;
}

const MODELS_URL = "https://api.groq.com/openai/v1/models";
const MODELS_TTL_MS = 60 * 60 * 1000;
const MAX_MODELS = 20;

const NON_CHAT_PATTERNS = [/whisper/i, /guard/i, /tts/i, /playai/i, /canary/i];

const FALLBACK_MODELS: GroqModel[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", context: 131072 },
  { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", context: 131072 },
  { id: "openai/gpt-oss-20b", name: "GPT OSS 20B", context: 131072 },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", context: 131072 },
];

let modelsCache: ModelsCache | null = null;

interface GroqModelEntry {
  id: string;
  active?: boolean;
  context_window?: number;
}

function toModel(e: GroqModelEntry): GroqModel {
  const short = e.id.split("/").pop() ?? e.id;
  return {
    id: e.id,
    name: short.replace(/-/g, " "),
    context: typeof e.context_window === "number" ? e.context_window : 0,
  };
}

async function listModels(key: string): Promise<GroqModelEntry[]> {
  const res = await fetch(MODELS_URL, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`Groq returned ${res.status}`);
  const data = (await res.json()) as { data?: GroqModelEntry[] };
  if (!Array.isArray(data.data)) throw new Error("Unexpected Groq response");
  return data.data.filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      e.active !== false &&
      !NON_CHAT_PATTERNS.some((p) => p.test(e.id))
  );
}

export async function fetchGroqModels(
  key: string
): Promise<{ models: GroqModel[]; fallback: boolean }> {
  if (modelsCache && modelsCache.expiresAt > Date.now()) {
    return { models: modelsCache.models, fallback: false };
  }
  try {
    const entries = await listModels(key);
    const models = entries.slice(0, MAX_MODELS).map(toModel);
    if (models.length === 0) throw new Error("No models listed");
    modelsCache = { models, expiresAt: Date.now() + MODELS_TTL_MS };
    return { models, fallback: false };
  } catch (e) {
    if (e instanceof Error && e.message === "unauthorized") throw e;
    return { models: FALLBACK_MODELS, fallback: true };
  }
}

export async function testGroqKey(
  key: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    await listModels(key);
    return { valid: true };
  } catch (e) {
    if (e instanceof Error && e.message === "unauthorized") {
      return { valid: false, error: "Key was rejected. Check it and try again." };
    }
    return { valid: false, error: "Could not reach Groq. Try again." };
  }
}
