"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { canAttachImages, imageTierName, isByokModelId } from "@/ai/models";
import { recordModelFailure, recordModelSuccess } from "@/lib/model-health";
import {
  MAX_CSV_CHARS,
  composeMessageContent,
  type ChatAttachment,
} from "@/lib/attachments";
import {
  conversationKey,
  type ConversationDetail,
} from "@/lib/chat-queries";
import { redirectIfUnauthorized } from "@/lib/api-fetch";
import { optimisticTitle } from "@/lib/chat-title";
import { MODELS, type AttachedFile, type ChatMessage, type ChatModel } from "./chat-types";

export type SyncResult = "ok" | "no-assistant" | "fetch-failed";

interface StreamEvent {
  t: string;
  s?: string;
  name?: string;
  state?: string;
  retryTier?: string;
}

export interface UseChatSendOptions {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  files: AttachedFile[];
  setFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  input: string;
  setInput: (v: string) => void;
  setAttachOpen: React.Dispatch<React.SetStateAction<boolean>>;
  model: ChatModel;
  chooseModel: (next: ChatModel, persist?: boolean) => void;
  activeConversationId: string | null;
  setActiveConversationId: (v: string | null) => void;
  setTitle: (v: string) => void;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (v: string | null) => void;
}

export function useChatSend(options: UseChatSendOptions) {
  const {
    messages,
    setMessages,
    files,
    setFiles,
    input,
    setInput,
    setAttachOpen,
    model,
    chooseModel,
    activeConversationId,
    setActiveConversationId,
    setTitle,
    sending,
    setSending,
    setError,
  } = options;
  const router = useRouter();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const [failedSend, setFailedSend] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [retryTier, setRetryTier] = useState<ChatModel | null>(null);

  function noteFailure(id: string) {
    setFailedSend(id);
    if (isByokModelId(id)) recordModelFailure(id);
  }

  // ponytail: fixed 3-attempt backoff, not exponential — sync usually lands on attempt 1.
  async function syncMessageIds(conversationId: string, quiet = false): Promise<SyncResult> {
    const delays = [500, 1000, 2000];
    let reachedServer = false;
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (redirectIfUnauthorized(res, router)) {
          return "fetch-failed";
        }
        if (!res.ok) continue;
        const data = await res.json();
        const synced: ChatMessage[] = (data.messages as { id: string; role: string; content: string }[])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            text: m.content,
            serverId: m.id,
          }));
        reachedServer = true;
        setMessages(synced);
        queryClient.setQueryData(
          conversationKey(conversationId),
          (prev: ConversationDetail | undefined) =>
            prev ? { ...prev, messages: synced } : prev
        );
        if (synced.length === 0 || synced[synced.length - 1].role === "assistant") return "ok";
      } catch {
        // fall through to retry
      }
    }
    if (reachedServer) return "no-assistant";
    if (!quiet) setError("Couldn't sync messages — refresh to see the latest.");
    return "fetch-failed";
  }

  async function truncateFrom(conversationId: string, fromServerId: string) {
    const res = await fetch(`/api/conversations/${conversationId}/truncate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromMessageId: fromServerId }),
    });
    if (redirectIfUnauthorized(res, router)) {
      throw new Error("Signed out");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? `Request failed (${res.status})`);
    }
  }

  async function handleSend(presetText?: string, base?: ChatMessage[]) {
    const text = (presetText ?? input).trim();
    if ((!text && files.length === 0) || sending) return;
    setError(null);
    setFailedSend(null);
    setRetryTier(null);
    setActiveTool(null);
    setAttachOpen(false);
    const outgoing = files;
    const attachments: ChatAttachment[] = [];
    for (const f of outgoing) {
      if (f.kind === "image" && f.url) {
        const ext = f.url.split("?")[0].split(".").pop()?.toLowerCase();
        attachments.push({
          kind: "image",
          name: f.name,
          mediaType: ext === "jpg" ? "image/jpeg" : "image/png",
          url: f.url,
        });
      } else if (f.kind === "csv" && f.file) {
        try {
          const raw = await f.file.text();
          attachments.push({ kind: "csv", name: f.name, text: raw.slice(0, MAX_CSV_CHARS) });
        } catch {
          setError(`Could not read ${f.name}.`);
          return;
        }
      }
    }
    if (attachments.some((a) => a.kind === "image") && !canAttachImages(model.id)) {
      setError(`Images need ${imageTierName()} — switch models to send.`);
      return;
    }
    if (outgoing.some((f) => f.kind === "image" && !f.url)) {
      setError("Wait for uploads to finish.");
      return;
    }
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: composeMessageContent(text, attachments),
      serverId: null,
    };
    const nextMessages = [...(base ?? messages), userMessage];
    if (!activeConversationId) {
      setTitle(optimisticTitle(text, outgoing[0]?.name));
    }
    setMessages(nextMessages);
    setFiles([]);
    setInput("");
    setSending(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "", serverId: null }]);

    let createdId: string | null = null;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: model.id,
          messages: [
            ...(base ?? messages).map((m) => ({ role: m.role, text: m.text })),
            { role: "user", text },
          ],
          attachments,
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        }),
      });

      if (!response.ok) {
        if (redirectIfUnauthorized(response, router)) {
          return;
        }
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${response.status})`);
      }

      createdId = response.headers.get("X-Conversation-Id");
      if (!activeConversationId && createdId) {
        setActiveConversationId(createdId);
        window.history.replaceState(null, "", `/chat/${createdId}`);
        window.dispatchEvent(new Event("conversations-changed"));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let done = false;
      let receivedAny = false;
      let searchUnavailableTier: string | null = null;
      let buffer = "";
      function handleLine(line: string) {
        if (!line.trim()) return;
        let event: StreamEvent | null = null;
        try {
          const parsed: unknown = JSON.parse(line);
          if (parsed && typeof parsed === "object" && typeof (parsed as StreamEvent).t === "string") {
            event = parsed as StreamEvent;
          }
        } catch {
          event = null;
        }
        if (!event) {
          receivedAny = true;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + line } : m))
          );
          return;
        }
        if (event.t === "text" && typeof event.s === "string") {
          receivedAny = true;
          const textChunk = event.s;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + textChunk } : m))
          );
        } else if (event.t === "tool") {
          receivedAny = true;
          if (event.state === "start") setActiveTool(event.name ?? "webSearch");
          else if (event.state === "done") setActiveTool(null);
        } else if (event.t === "search-unavailable" && typeof event.retryTier === "string") {
          searchUnavailableTier = event.retryTier;
        }
      }
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) handleLine(line);
        }
      }
      if (buffer.trim()) handleLine(buffer);
      setActiveTool(null);

      const syncId = createdId ?? activeConversationId;
      if (!receivedAny) {
        noteFailure(model.id);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        if (syncId) {
          await syncMessageIds(syncId, true);
          window.dispatchEvent(new Event("conversations-changed"));
        }
        setError(`${model.name} returned nothing — it may be down. Try another model.`);
        return;
      }
      if (searchUnavailableTier) {
        const fallback = MODELS.find((m) => m.id === searchUnavailableTier) ?? null;
        setFailedSend(model.id);
        setRetryTier(fallback);
        setError(`Retry with ${fallback?.name ?? "Glimmer 3.5"} to search the web.`);
      }
      if (syncId) {
        const syncResult = await syncMessageIds(syncId);
        if (syncResult === "ok") recordModelSuccess(model.id);
        else if (syncResult === "no-assistant") {
          noteFailure(model.id);
          setError(`${model.name} returned nothing — it may be down. Try another model.`);
        }
        window.dispatchEvent(new Event("conversations-changed"));
        if (createdId) {
          try {
            const meta = await fetch(`/api/conversations/${syncId}`);
            if (meta.ok) {
              const data = await meta.json();
              if (data.conversation?.title) {
                setTitle(data.conversation.title);
                queryClient.setQueryData(
                  conversationKey(syncId),
                  (prev: ConversationDetail | undefined) =>
                    prev
                      ? { ...prev, title: data.conversation.title }
                      : { messages: [], title: data.conversation.title, model: "" }
                );
              }
            }
          } catch (e) {
            console.warn("chat: refresh title failed", e instanceof Error ? e.message : e);
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId && last.text.trim().length === 0) {
            return prev.filter((m) => m.id !== assistantId);
          }
          return prev;
        });
        const syncId = createdId ?? activeConversationId;
        if (syncId) {
          window.setTimeout(() => {
            void syncMessageIds(syncId).then((result) => {
              if (result === "ok") window.dispatchEvent(new Event("conversations-changed"));
            });
          }, 800);
        }
      } else {
        const message = e instanceof Error ? e.message : "Something went wrong";
        noteFailure(model.id);
        setError(message);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
      setActiveTool(null);
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleRetry() {
    if (sending || !activeConversationId) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastAssistant || !lastUser || !lastUser.serverId) return;
    if (lastAssistant.id !== messages[messages.length - 1]?.id) return;
    setError(null);
    setSending(true);
    try {
      await truncateFrom(activeConversationId, lastUser.serverId);
      const kept = messages.filter((m) => m.id !== lastAssistant.id && m.id !== lastUser.id);
      setMessages(kept);
      setSending(false);
      await handleSend(lastUser.text, kept);
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function saveEdit(message: ChatMessage, draft: string) {
    const text = draft.trim();
    if (!text || sending || !activeConversationId || !message.serverId) return;
    setError(null);
    setSending(true);
    try {
      await truncateFrom(activeConversationId, message.serverId);
      const index = messages.findIndex((m) => m.id === message.id);
      const sliced = index === -1 ? messages : messages.slice(0, index);
      setMessages(sliced);
      setSending(false);
      await handleSend(text, sliced);
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function handleRetryWithTier(tier: ChatModel) {
    if (sending || !activeConversationId) return;
    setError(null);
    setFailedSend(null);
    setRetryTier(null);
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}/messages`);
      if (redirectIfUnauthorized(res, router)) return;
      if (!res.ok) throw new Error("Could not reload messages.");
      const data = await res.json();
      const server = (
        (data.messages ?? []) as { id: string; role: string; content: string }[]
      ).filter((m) => m.role === "user" || m.role === "assistant");
      const lastUser = [...server].reverse().find((m) => m.role === "user");
      if (!lastUser) throw new Error("Nothing to retry.");
      await truncateFrom(activeConversationId, lastUser.id);
      const trimmed = [...messages];
      if (trimmed[trimmed.length - 1]?.role === "assistant") trimmed.pop();
      if (trimmed[trimmed.length - 1]?.role !== "user") {
        throw new Error("Nothing to retry.");
      }
      trimmed.pop();
      setMessages(trimmed);
      chooseModel(tier);
      setSending(false);
      await handleSend(lastUser.content, trimmed);
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return { handleSend, handleStop, handleRetry, handleRetryWithTier, failedSend, activeTool, retryTier, saveEdit, truncateFrom, syncMessageIds };
}
