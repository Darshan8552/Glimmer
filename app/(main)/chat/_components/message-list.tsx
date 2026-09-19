"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GlimmerMark } from "@/components/glimmer-mark";
import AssistantMessage from "./assistant-message";
import CopyButton from "./copy-button";
import { MODELS, type ChatMessage, type ChatModel, type HeaderMode } from "./chat-types";
import { BYOK_PROVIDERS, isByokModelId, type ByokProvider } from "@/ai/models";
import {
  getHiddenModels,
  isModelDown,
  toggleHiddenModel,
} from "@/lib/model-health";

const STARTERS = [
  "Explain a tricky concept in simple terms",
  "Help me debug a piece of code",
  "Draft a concise professional email",
];

function splitUserContent(text: string): {
  images: { name: string; url: string }[];
  body: string;
} {
  const pattern = /!\[([^\]]*)\]\(https:\/\/res\.cloudinary\.com\/[^)\s]+\)/g;
  const images: { name: string; url: string }[] = [];
  const textParts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    textParts.push(text.slice(last, match.index));
    images.push({
      name: match[1],
      url: match[0].slice(match[0].indexOf("](") + 2, -1),
    });
    last = match.index + match[0].length;
  }
  textParts.push(text.slice(last));
  return { images, body: textParts.join("").trim() };
}

export function ModelPicker({
  model,
  chooseModel,
  menuAlign,
  models = MODELS,
  connectedProviders = null,
}: {
  model: ChatModel;
  chooseModel: (next: ChatModel, persist?: boolean) => void;
  menuAlign: "left" | "right";
  models?: ChatModel[];
  connectedProviders?: string[] | null;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [, bumpHidden] = useState(0);
  const hidden = getHiddenModels();
  const visible = models.filter(
    (m) => m.provider === "glimmer" || showHidden || !hidden.includes(m.id)
  );
  const glimmerModels = visible.filter((m) => m.provider === "glimmer");
  const byokGroups = (Object.keys(BYOK_PROVIDERS) as ByokProvider[])
    .map((provider) => ({
      provider,
      label: BYOK_PROVIDERS[provider].label,
      models: visible.filter((m) => m.provider === provider),
      connected: connectedProviders?.includes(provider) ?? null,
    }))
    .filter((g) => g.models.length > 0 || g.connected === false);
  const hiddenCount = models.filter(
    (m) => m.provider !== "glimmer" && hidden.includes(m.id)
  ).length;

  function flipHidden(id: string) {
    toggleHiddenModel(id);
    bumpHidden((t) => t + 1);
  }

  function modelRow(m: ChatModel) {
    const down = m.provider !== "glimmer" && isModelDown(m.id);
    const isHidden = hidden.includes(m.id);
    return (
      <div
        key={m.id}
        className={`group/row flex w-full items-start gap-2.5 px-3 py-2 transition hover:bg-accent ${m.id === model.id ? "bg-accent" : ""}`}
      >
        <button
          onClick={() => { chooseModel(m); setModelOpen(false); }}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <div className="mt-0.5">
            {m.id === model.id ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <div className="size-3.5 rounded-full border-2 border-muted-foreground/30" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              {m.name}
              {down && (
                <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-px text-[10px] font-normal text-destructive">
                  may be down
                </span>
              )}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{m.desc}</p>
          </div>
        </button>
        {m.provider !== "glimmer" && (
          <button
            onClick={() => flipHidden(m.id)}
            title={isHidden ? "Show this model" : "Hide this model"}
            aria-label={isHidden ? "Show this model" : "Hide this model"}
            className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
          >
            {isHidden ? "Unhide" : "Hide"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setModelOpen((o) => !o)}
        aria-label="Select model"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        {model.name}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${modelOpen ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {modelOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setModelOpen(false)} />
          <div className={`absolute top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg ${menuAlign === "left" ? "left-0" : "right-0"}`}>
            <div className="max-h-80 overflow-y-auto py-1">
              <p className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Glimmer
              </p>
              {glimmerModels.map(modelRow)}
              {byokGroups.map((g) => (
                <div key={g.provider}>
                  <p className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </p>
                  {g.models.map(modelRow)}
                  {g.connected === false && g.models.length === 0 && (
                    <Link
                      href="/chat/settings"
                      onClick={() => setModelOpen(false)}
                      className="block px-3 py-2 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      {`+ Connect ${g.label} key in Settings`}
                    </Link>
                  )}
                </div>
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowHidden((s) => !s)}
                  className="block w-full px-3 py-2 text-left text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  {showHidden
                    ? "Hide hidden models"
                    : `Show ${hiddenCount} hidden model${hiddenCount === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export interface MessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  activeConversationId: string | null;
  headerMode?: HeaderMode;
  title: string;
  renaming: boolean;
  setRenaming: (v: boolean) => void;
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  onRename: () => void;
  onCancelRename: () => void;
  model: ChatModel;
  chooseModel: (next: ChatModel, persist?: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  onDelete: () => void;
  onRetry: () => void;
  onSaveEdit: (message: ChatMessage, draft: string) => void;
  onPreview: (url: string, name: string) => void;
  setInput: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
  models?: ChatModel[];
  connectedProviders?: string[] | null;
  failedModelId?: string | null;
  retryTierName?: string | null;
  activeTool?: string | null;
  onRetryWithTier?: () => void;
}

export default function MessageList({
  messages,
  sending,
  error,
  activeConversationId,
  headerMode: headerModeProp,
  title,
  renaming,
  setRenaming,
  renameDraft,
  setRenameDraft,
  onRename,
  onCancelRename,
  model,
  chooseModel,
  menuOpen,
  setMenuOpen,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onDelete,
  onRetry,
  onSaveEdit,
  onPreview,
  setInput,
  textareaRef,
  headerRef,
  models = MODELS,
  connectedProviders = null,
  failedModelId = null,
  retryTierName = null,
  activeTool = null,
  onRetryWithTier,
}: MessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const headerMode: HeaderMode =
    headerModeProp ??
    (activeConversationId ? "active" : messages.length > 0 ? "pending" : "empty");
  const isPending = headerMode === "pending";

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDeleteConfirm(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDeleteConfirm, setShowDeleteConfirm]);

  function handleMessagesScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 120;
    setShowScrollButton(distance > 300);
  }

  function scrollToBottom() {
    const el = messagesScrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowScrollButton(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  function startEdit(message: ChatMessage) {
    if (sending || !message.serverId) return;
    setEditingId(message.id);
    setEditDraft(message.text);
  }

  function saveAndClose(message: ChatMessage) {
    setEditingId(null);
    onSaveEdit(message, editDraft);
  }

  function startRename() {
    setRenameDraft(title);
    setRenaming(true);
    setMenuOpen(false);
  }

  function openDeleteConfirm() {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  }

  return (
    <>
      {headerMode !== "empty" && (
        <div
          ref={headerRef}
          className="relative flex items-center gap-3 bg-transparent px-4 py-2.5 shrink-0"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {renaming && !isPending ? (
              <input
                ref={(el) => el?.focus()}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onRename();
                  } else if (e.key === "Escape") {
                    onCancelRename();
                  }
                }}
                onBlur={onRename}
                className="flex-1 min-w-0 bg-transparent text-[14px] font-medium text-foreground outline-none placeholder:text-muted-foreground truncate"
                placeholder="Untitled"
              />
            ) : isPending ? (
              <h1
                aria-busy={sending}
                className="flex-1 min-w-0 truncate text-[14px] font-medium text-foreground"
              >
                {title || "Untitled"}
              </h1>
            ) : (
              <h1
                onClick={startRename}
                className="flex-1 min-w-0 truncate text-[14px] font-medium text-foreground hover:underline cursor-pointer"
                title="Click to rename"
              >
                {title || "Untitled"}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ModelPicker model={model} chooseModel={chooseModel} menuAlign="right" models={models} connectedProviders={connectedProviders} />
            {!isPending && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Conversation options"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                    <div className="py-1">
                      <button
                        onClick={startRename}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-accent"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                        Rename
                      </button>
                      <button
                        onClick={openDeleteConfirm}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-destructive transition hover:bg-destructive/10"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2-2V6" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-conversation-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-popover p-5 shadow-xl">
            <h2 id="delete-conversation-title" className="text-[16px] font-semibold text-foreground">Delete conversation?</h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              This action cannot be undone. All messages will be permanently removed.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                autoFocus
                className="rounded-xl px-4 py-2 text-[13px] font-medium text-foreground transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="rounded-xl bg-destructive px-4 py-2 text-[13px] font-medium text-destructive-foreground transition hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="flex flex-1 overflow-y-auto px-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
              <GlimmerMark size={52} />
              <div>
                <h1 className="text-[22px] font-semibold tracking-tight text-foreground">How can I help you today?</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">Ask me anything — I&apos;m here to help.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[12.5px] text-muted-foreground transition hover:border-ring hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6">
            {messages.map((m, index) => {
              const isLast = index === messages.length - 1;
              const isEditing = editingId === m.id;
              const userParts =
                m.role === "user" && !isEditing ? splitUserContent(m.text) : null;
              return (
              <div key={m.id} className={`group message-in flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {userParts && userParts.images.length > 0 && (
                  <div className="flex gap-2">
                    {userParts.images.map((img, i) => (
                      <img
                        key={`img-${i}`}
                        src={img.url}
                        alt={img.name}
                        title={img.name}
                        loading="lazy"
                        onClick={() => onPreview(img.url, img.name)}
                        className="size-16 cursor-zoom-in rounded-xl border border-border object-cover"
                      />
                    ))}
                  </div>
                )}
                {(!userParts || userParts.body.length > 0 || isEditing) && (
                <div
                  className={`text-[14px] leading-6 ${
                    m.role === "user"
                      ? "whitespace-pre-wrap max-w-[85%] rounded-2xl bg-bubble-user px-4 py-2.5 text-bubble-user-foreground"
                      : "whitespace-normal w-full bg-bubble-assistant px-1 py-1 text-foreground"
                  }`}
                >
                  {isEditing ? (
                    <div className="flex min-w-[240px] flex-col gap-2">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            saveAndClose(m);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        rows={3}
                        autoFocus
                        className="resize-none rounded-xl bg-transparent text-[14px] leading-6 outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg px-2.5 py-1 text-[12px] opacity-70 transition hover:opacity-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveAndClose(m)}
                          disabled={!editDraft.trim()}
                          className="rounded-lg bg-primary-foreground/15 px-2.5 py-1 text-[12px] font-medium transition hover:bg-primary-foreground/25 disabled:opacity-40"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : m.role === "assistant" ? (
                    <AssistantMessage
                      text={m.text}
                      streaming={sending && isLast}
                      toolStatus={sending && isLast ? activeTool : null}
                    />
                  ) : (
                    userParts ? userParts.body : m.text
                  )}
                </div>
                )}
                {!sending && !isEditing && m.role === "user" && (
                  <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <CopyButton text={m.text} />
                    {m.serverId && (
                  <button
                    onClick={() => startEdit(m)}
                    title="Edit message"
                    className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    Edit
                  </button>
                    )}
                  </div>
                )}
                {!sending && m.role === "assistant" && (
                  <div className="flex items-center gap-0.5">
                    <CopyButton text={m.text} />
                    {isLast && m.serverId && (
                  <button
                    onClick={onRetry}
                    title="Regenerate response"
                    className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Retry
                  </button>
                    )}
                  </div>
                )}
              </div>
              );
            })}
            {error && (
              <div className="flex items-center justify-center gap-2 text-center">
                <p className="text-[12px] text-destructive">{error}</p>
                {failedModelId && (isByokModelId(failedModelId) || retryTierName) && onRetryWithTier && !sending && (
                  <button
                    onClick={onRetryWithTier}
                    className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-foreground transition hover:bg-accent"
                  >
                    Retry with {retryTierName ?? "Glimmer 4"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showScrollButton && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
          className="absolute bottom-24 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition hover:bg-accent hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}
    </>
  );
}
