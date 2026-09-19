import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export const MODEL_REGISTRY = {
  "glimmer-4": {
    provider: "nim",
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    maxOutputTokens: 4096,
    capabilities: { images: [], textFiles: true },
    // ponytail: Ultra returns empty streams on tool calls (verified 2026-09-19) — flip if NVIDIA confirms support.
    supportsTools: false,
  },
  "glimmer-4-turbo": {
    provider: "nim",
    model: "nvidia/nemotron-3-super-120b-a12b",
    maxOutputTokens: 4096,
    capabilities: { images: [], textFiles: true },
    supportsTools: true,
  },
  "glimmer-3.5": {
    provider: "nim",
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    maxOutputTokens: 4096,
    capabilities: { images: ["image/jpeg", "image/png"], textFiles: true },
    supportsTools: true,
  },
} as const;

export type ModelTier = keyof typeof MODEL_REGISTRY;

export const MODEL_DISPLAY = {
  "glimmer-4": { name: "Glimmer 4", desc: "Best for most tasks" },
  "glimmer-4-turbo": { name: "Glimmer 4 Turbo", desc: "Faster, smarter" },
  "glimmer-3.5": { name: "Glimmer 3.5", desc: "Quick, sees images" },
} as const;

export const MODEL_TIERS: ModelTier[] = [
  "glimmer-4",
  "glimmer-4-turbo",
  "glimmer-3.5",
];

let nimClient: ReturnType<typeof createOpenAI> | null = null;

function getNimClient() {
  if (!nimClient) {
    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
      throw new Error("NVIDIA_NIM_API_KEY is not set in .env.local");
    }
    nimClient = createOpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey,
    });
  }
  return nimClient;
}

export function getModel(tier: ModelTier): LanguageModel {
  const config = MODEL_REGISTRY[tier];
  if (!config) {
    throw new Error(`Unknown model tier: ${tier}`);
  }
  switch (config.provider) {
    case "nim":
      return getNimClient().chat(config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getMaxOutputTokens(tier: ModelTier): number {
  return MODEL_REGISTRY[tier].maxOutputTokens;
}

export const BYOK_PROVIDERS = {
  openrouter: { label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1" },
  groq: { label: "Groq", baseURL: "https://api.groq.com/openai/v1" },
} as const;

export type ByokProvider = keyof typeof BYOK_PROVIDERS;

export function parseByokModelId(
  value: string
): { provider: ByokProvider; slug: string } | null {
  const sep = value.indexOf(":");
  if (sep === -1 || value.length > 200) return null;
  const provider = value.slice(0, sep);
  const slug = value.slice(sep + 1);
  if (!(provider in BYOK_PROVIDERS) || slug.length < 3) return null;
  return { provider: provider as ByokProvider, slug };
}

export function isByokModelId(value: string): boolean {
  return parseByokModelId(value) !== null;
}

export function modelLabel(value: string): string {
  const display = MODEL_DISPLAY[value as keyof typeof MODEL_DISPLAY];
  if (display) return display.name;
  const byok = parseByokModelId(value);
  if (byok) {
    const short = byok.slug.split("/").pop() ?? byok.slug;
    return short.replace(/:free$/, "").replace(/-/g, " ");
  }
  return value;
}

export const IMAGE_TIERS: ModelTier[] = MODEL_TIERS.filter(
  (tier) => MODEL_REGISTRY[tier].capabilities.images.length > 0
);

export function canAttachImages(tier: string): boolean {
  const caps = MODEL_REGISTRY[tier as ModelTier]?.capabilities;
  return caps ? caps.images.length > 0 : false;
}

export function imageTierName(): string {
  return IMAGE_TIERS.map((tier) => MODEL_DISPLAY[tier].name).join(" or ");
}

export const SEARCH_FALLBACK_TIER: ModelTier = "glimmer-3.5";

export const SEARCH_UNAVAILABLE_PREFIX = "search isn't available with this model";

export function searchUnavailableMessage(): string {
  return `Search isn't available with this model. Retry with ${MODEL_DISPLAY[SEARCH_FALLBACK_TIER].name} for web search.`;
}

export function buildSystemPrompt(tier: ModelTier, userPrompt?: string): string {
  const internal =
    `You are ${MODEL_DISPLAY[tier].name}, an AI assistant in the Glimmer app. ` +
    `If asked about your identity, model, or who made you, say you are ` +
    `${MODEL_DISPLAY[tier].name} by Glimmer. Never mention NVIDIA, Nemotron, ` +
    `Llama, Mistral, or any underlying model, provider, or API. ` +
    `When the question needs current or external facts beyond training, ` +
    `call webSearch first, then end your answer with a Sources: list of ` +
    `markdown links to the pages used. ` +
    `When the user asks for a diagram, flowchart, or visual overview, ` +
    `include it as a \`\`\`mermaid fenced code block. ` +
    `Keep diagrams compact (around 12 nodes or fewer) and prefer ` +
    `left-to-right layout for processes.`;
  const custom = userPrompt?.trim();
  return custom ? `${internal}\n\nUser instructions:\n${custom}` : internal;
}

export function buildByokSystemPrompt(name: string, userPrompt?: string): string {
  const internal =
    `You are ${name}, an AI assistant in the Glimmer app. ` +
    `If asked about your identity or model, say you are ${name} running in Glimmer. ` +
    `When the question needs current or external facts beyond training, ` +
    `call webSearch first, then end your answer with a Sources: list of ` +
    `markdown links to the pages used. ` +
    `When the user asks for a diagram, flowchart, or visual overview, ` +
    `include it as a \`\`\`mermaid fenced code block. ` +
    `Keep diagrams compact (around 12 nodes or fewer) and prefer ` +
    `left-to-right layout for processes.`;
  const custom = userPrompt?.trim();
  return custom ? `${internal}\n\nUser instructions:\n${custom}` : internal;
}
