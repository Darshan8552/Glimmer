"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  conversationKey,
  fetchByokModels,
  fetchProviderStatus,
  PROVIDER_STALE_MS,
  providerModelsKey,
  providerStatusKey,
  type ConversationDetail,
} from "@/lib/chat-queries";
import { isByokModelId, parseByokModelId } from "@/ai/models";
import { MODELS, type AttachedFile, type ChatMessage, type ChatModel, type ByokChatModel, type HeaderMode } from "./chat-types";
import { useChatSend } from "./use-chat-send";
import MessageList, { ModelPicker } from "./message-list";
import Composer from "./composer";

export type { ChatMessage } from "./chat-types";

const MODEL_STORAGE_KEY = "glimmer:model";

function resolveInitialModel(preferred: string | undefined, all: ChatModel[]): ChatModel {
  if (preferred) {
    const found = all.find((m) => m.id === preferred);
    if (found) return found;
  }
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
      const found = all.find((m) => m.id === saved);
      if (found) return found;
    } catch (e) {
      console.warn("chat: read saved model failed", e instanceof Error ? e.message : e);
    }
  }
  return MODELS[0];
}

function savedModelId(preferred?: string): string | null {
  if (preferred) return preferred;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MODEL_STORAGE_KEY);
  } catch (e) {
    console.warn("chat: read saved model failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export default function ChatThread({
  conversationId: initialConversationId,
  title: initialTitle,
  initialMessages,
  initialModel,
}: {
  conversationId: string | null;
  title?: string;
  initialMessages: ChatMessage[];
  initialModel?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ChatModel>(() =>
    resolveInitialModel(initialModel, MODELS)
  );
  const statusQuery = useQuery({
    queryKey: providerStatusKey,
    queryFn: fetchProviderStatus,
    staleTime: PROVIDER_STALE_MS,
  });
  const connectedProviders: string[] | null = statusQuery.isError
    ? []
    : statusQuery.data
      ? statusQuery.data.filter((s) => s.connected).map((s) => s.provider)
      : null;
  const modelsQueries = useQueries({
    queries: (connectedProviders ?? []).map((p) => ({
      queryKey: providerModelsKey(p),
      queryFn: () => fetchByokModels(p),
      staleTime: PROVIDER_STALE_MS,
    })),
  });
  const byokModels: ByokChatModel[] = [];
  for (const q of modelsQueries) {
    for (const o of q.data ?? []) {
      const parsed = parseByokModelId(o.id);
      if (!parsed) continue;
      byokModels.push({
        id: o.id,
        provider: parsed.provider,
        name: o.name,
        desc: parsed.slug,
      });
    }
  }
  const allModels: ChatModel[] = [...MODELS, ...byokModels];
  const byokKey = byokModels.map((m) => m.id).join("|");

  useEffect(() => {
    if (byokKey === "") return;
    const want = savedModelId(initialModel);
    if (!want || !isByokModelId(want)) return;
    if (!byokKey.split("|").includes(want)) return;
    Promise.resolve().then(() => {
      const found = byokModels.find((m) => m.id === want);
      if (found) {
        setModel((prev) => (prev.id === MODELS[0].id ? found : prev));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byokKey, initialModel]);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle ?? "Untitled");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { handleSend, handleStop, handleRetry, handleRetryWithTier, failedSend, activeTool, retryTier, saveEdit } = useChatSend({
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
  });

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function chooseModel(next: ChatModel, persist = true) {
    setModel(next);
    if (persist) {
      try {
        window.localStorage.setItem(MODEL_STORAGE_KEY, next.id);
      } catch (e) {
        console.warn("chat: persist model failed", e instanceof Error ? e.message : e);
      }
    }
  }

  async function handleRename() {
    const newTitle = renameDraft.trim();
    if (!newTitle || !activeConversationId || newTitle === title) {
      setRenaming(false);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setTitle(newTitle);
      queryClient.setQueryData(
        conversationKey(activeConversationId),
        (prev: ConversationDetail | undefined) =>
          prev ? { ...prev, title: newTitle } : prev
      );
      window.dispatchEvent(new Event("conversations-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename conversation.");
    } finally {
      setRenaming(false);
    }
  }

  function cancelRename() {
    setRenaming(false);
  }

  async function handleDelete() {
    if (!activeConversationId) return;
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      queryClient.removeQueries({ queryKey: conversationKey(activeConversationId) });
      window.dispatchEvent(new Event("conversations-changed"));
      router.push("/chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete conversation.");
    }
  }

  function handlePreview(url: string, name: string) {
    setLightbox({ url, name });
  }

  const headerMode: HeaderMode = activeConversationId
    ? "active"
    : messages.length > 0
      ? "pending"
      : "empty";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {headerMode === "empty" && (
        <div className="absolute right-4 top-3 z-10">
          <ModelPicker model={model} chooseModel={chooseModel} menuAlign="right" models={allModels} connectedProviders={connectedProviders} />
        </div>
      )}

      <MessageList
        messages={messages}
        sending={sending}
        error={error}
        activeConversationId={activeConversationId}
        headerMode={headerMode}
        activeTool={activeTool}
        retryTierName={retryTier?.name ?? null}
        title={title}
        renaming={renaming}
        setRenaming={setRenaming}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        onRename={handleRename}
        onCancelRename={cancelRename}
        model={model}
        chooseModel={chooseModel}
        models={allModels}
        connectedProviders={connectedProviders}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        onDelete={handleDelete}
        onRetry={handleRetry}
        failedModelId={failedSend}
        onRetryWithTier={() => handleRetryWithTier(retryTier ?? MODELS[0])}
        onSaveEdit={saveEdit}
        onPreview={handlePreview}
        setInput={setInput}
        textareaRef={textareaRef}
        headerRef={headerRef}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Image viewer: ${lightbox.name}`}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close image viewer"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <figure className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-[85vh] max-w-full rounded-xl object-contain"
            />
            <figcaption className="mt-2 text-center text-[12px] text-white/80">
              {lightbox.name}
            </figcaption>
          </figure>
        </div>
      )}

      <Composer
        input={input}
        setInput={setInput}
        files={files}
        setFiles={setFiles}
        sending={sending}
        model={model}
        chooseModel={chooseModel}
        attachOpen={attachOpen}
        setAttachOpen={setAttachOpen}
        onSend={() => handleSend()}
        onStop={handleStop}
        textareaRef={textareaRef}
        onPreview={handlePreview}
      />
    </div>
  );
}
