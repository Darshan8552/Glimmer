import { MODEL_DISPLAY, MODEL_TIERS, type ByokProvider } from "@/ai/models";

export const MODELS = MODEL_TIERS.map((tier) => ({
  id: tier,
  provider: "glimmer" as const,
  ...MODEL_DISPLAY[tier],
}));

export type ChatModel = (typeof MODELS)[number] | ByokChatModel;

export interface ByokChatModel {
  id: string;
  provider: ByokProvider;
  name: string;
  desc: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  serverId: string | null;
}

export type HeaderMode = "empty" | "pending" | "active";

export interface AttachedFile {
  id: string;
  kind: "image" | "csv";
  name: string;
  size: number;
  file?: File;
  preview?: string;
  url?: string;
  progress?: number;
}
