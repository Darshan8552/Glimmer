import { QueryHttpError } from "@/components/query-provider";

export interface ConversationListItem {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  isPinned: boolean;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  serverId: string;
}

export interface ConversationDetail {
  messages: ConversationMessage[];
  title: string;
  model: string;
}

export const conversationListKey = ["conversations"] as const;

export const providerStatusKey = ["providers", "status"] as const;

export function providerModelsKey(provider: string) {
  return ["providers", "models", provider] as const;
}

export const PROVIDER_STALE_MS = 5 * 60 * 1000;

export interface ProviderStatusInfo {
  provider: string;
  connected: boolean;
  masked?: string | null;
  length?: number | null;
}

export async function fetchProviderStatus(): Promise<ProviderStatusInfo[]> {
  const res = await fetch("/api/providers");
  if (!res.ok) throw new QueryHttpError(res.status, await readError(res));
  const data = await res.json();
  return Array.isArray(data.providers) ? data.providers : [];
}

export interface OpenRouterModelOption {
  id: string;
  name: string;
  context?: number;
  free?: boolean | null;
  inModalities?: string[];
  outModalities?: string[];
  tools?: boolean | null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

export async function fetchByokModels(
  provider: string
): Promise<OpenRouterModelOption[]> {
  const path =
    provider === "groq"
      ? "/api/providers/groq/models"
      : "/api/providers/openrouter/models";
  const res = await fetch(path);
  if (!res.ok) throw new QueryHttpError(res.status, await readError(res));
  const data = await res.json();
  if (!Array.isArray(data.models)) return [];
  return (data.models as Record<string, unknown>[])
    .filter((m) => m && typeof m.id === "string" && typeof m.name === "string")
    .map((m) => ({
      id: `${provider}:${m.id as string}`,
      name: m.name as string,
      context: typeof m.context === "number" ? m.context : undefined,
      free: typeof m.free === "boolean" ? m.free : m.free === null ? null : undefined,
      inModalities: stringArray(m.inModalities),
      outModalities: stringArray(m.outModalities),
      tools: typeof m.tools === "boolean" ? m.tools : m.tools === null ? null : undefined,
    }));
}
export function conversationKey(id: string) {
  return ["conversation", id] as const;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return (
    (data && typeof data.error === "string" && data.error) ||
    `Request failed (${res.status})`
  );
}

export function conversationSearchKey(q: string) {
  return ["conversations", q] as const;
}

export async function fetchConversations(q?: string): Promise<ConversationListItem[]> {
  const url = q ? `/api/conversations?q=${encodeURIComponent(q)}` : "/api/conversations";
  const res = await fetch(url);
  if (!res.ok) throw new QueryHttpError(res.status, await readError(res));
  const data = await res.json();
  return (data.conversations ?? []) as ConversationListItem[];
}

export async function fetchConversationDetail(id: string): Promise<ConversationDetail> {
  const [messagesRes, metaRes] = await Promise.all([
    fetch(`/api/conversations/${id}/messages`),
    fetch(`/api/conversations/${id}`),
  ]);
  if (messagesRes.status === 401 || metaRes.status === 401) {
    throw new QueryHttpError(401, "Signed out");
  }
  if (!messagesRes.ok || !metaRes.ok) {
    const failing = !messagesRes.ok ? messagesRes : metaRes;
    throw new QueryHttpError(failing.status, await readError(failing));
  }
  const [messagesData, metaData] = await Promise.all([
    messagesRes.json(),
    metaRes.json(),
  ]);
  const messages = (
    (messagesData.messages ?? []) as { id: string; role: string; content: string }[]
  )
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      text: m.content,
      serverId: m.id,
    }));
  return {
    messages,
    title: typeof metaData.conversation?.title === "string" ? metaData.conversation.title : "Untitled",
    model: typeof metaData.conversation?.model === "string" ? metaData.conversation.model : "",
  };
}
