"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_TIERS, canAttachImages, imageTierName } from "@/ai/models";
import { uploadImage } from "@/lib/cloudinary-client";
import {
  MAX_ATTACHMENTS,
  CSV_MAX_BYTES,
} from "@/lib/attachments";
import type { AttachedFile, ChatModel } from "./chat-types";
import { MODELS } from "./chat-types";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const uploadsConfigured = !!CLOUD_NAME && !!UPLOAD_PRESET;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_CSV = ".csv";

function FileTypeIcon({ type }: { type: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  if (type.startsWith("image/")) {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-5-5-9 9" />
      </svg>
    );
  }
  if (type === "application/pdf") {
    return (
      <svg {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6M9 11h2" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

function AttachButton({
  disabled,
  attachOpen,
  onToggle,
  uploadsConfigured,
  photosAllowed,
  switchLabel,
  onPhoto,
  onCsv,
  onSwitch,
}: {
  disabled: boolean;
  attachOpen: boolean;
  onToggle: () => void;
  uploadsConfigured: boolean;
  photosAllowed: boolean;
  switchLabel: string;
  onPhoto: () => void;
  onCsv: () => void;
  onSwitch: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={onToggle}
        disabled={disabled}
        className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        title="Attach file"
        aria-label="Attach file"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      {attachOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggle} />
          <div className="absolute bottom-full left-0 z-40 mb-2 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            <div className="py-1">
              {uploadsConfigured && photosAllowed ? (
                <button
                  onClick={onPhoto}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-accent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="M21 15l-5-5-9 9" />
                  </svg>
                  Upload photo
                </button>
              ) : (
                <button
                  onClick={onSwitch}
                  disabled={!uploadsConfigured}
                  title={uploadsConfigured ? `Switch to ${switchLabel}` : "Photo uploads are not configured"}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="M21 15l-5-5-9 9" />
                  </svg>
                  {uploadsConfigured
                    ? `Photos need ${switchLabel} — switch`
                    : "Photo uploads not configured"}
                </button>
              )}
              <button
                onClick={onCsv}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-accent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 9h18M9 9v11" />
                </svg>
                Attach CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export interface ComposerProps {
  input: string;
  setInput: (v: string) => void;
  files: AttachedFile[];
  setFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  sending: boolean;
  model: ChatModel;
  chooseModel: (next: ChatModel, persist?: boolean) => void;
  attachOpen: boolean;
  setAttachOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSend: () => void;
  onStop: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onPreview: (url: string, name: string) => void;
}

export default function Composer({
  input,
  setInput,
  files,
  setFiles,
  sending,
  model,
  chooseModel,
  attachOpen,
  setAttachOpen,
  onSend,
  onStop,
  textareaRef,
  onPreview,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadAborts = useRef(new Map<string, () => void>());
  const attachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  const uploading = files.some((f) => f.kind === "image" && !f.url);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
  }, [input, textareaRef]);

  function flashAttachError(message: string) {
    if (attachTimer.current) clearTimeout(attachTimer.current);
    setAttachError(message);
    attachTimer.current = setTimeout(() => setAttachError(null), 4000);
  }

  useEffect(() => {
    const aborts = uploadAborts.current;
    return () => {
      if (attachTimer.current) clearTimeout(attachTimer.current);
      aborts.forEach((abort) => abort());
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function addCsvFiles(newFiles: FileList | File[]) {
    const incoming = Array.from(newFiles).filter(
      (f) =>
        f.size <= CSV_MAX_BYTES &&
        (f.type === "text/csv" || f.name.toLowerCase().endsWith(".csv"))
    );
    if (incoming.length === 0) {
      flashAttachError("Only CSV files up to 1 MB can be attached as text.");
      return;
    }
    const room = MAX_ATTACHMENTS - files.length;
    if (room <= 0) {
      flashAttachError(`At most ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    const picked = incoming.slice(0, room);
    if (picked.length < incoming.length) {
      flashAttachError(`At most ${MAX_ATTACHMENTS} attachments per message.`);
    } else {
      setAttachError(null);
    }
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({
        id: crypto.randomUUID(),
        kind: "csv" as const,
        name: file.name,
        size: file.size,
        file,
      })),
    ]);
  }

  function addImageFiles(newFiles: FileList | File[]) {
    if (!uploadsConfigured || !UPLOAD_PRESET || !CLOUD_NAME) {
      flashAttachError("Photo uploads are not configured.");
      return;
    }
    const incoming = Array.from(newFiles).filter((f) => {
      const ext = f.name.toLowerCase().split(".").pop();
      return (
        f.size <= MAX_IMAGE_BYTES &&
        (f.type === "image/jpeg" ||
          f.type === "image/png" ||
          ext === "jpg" ||
          ext === "jpeg" ||
          ext === "png")
      );
    });
    if (incoming.length === 0) {
      flashAttachError("Only JPG and PNG photos up to 5 MB.");
      return;
    }
    const room = MAX_ATTACHMENTS - files.length;
    if (room <= 0) {
      flashAttachError(`At most ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    const picked = incoming.slice(0, room);
    if (picked.length < incoming.length) {
      flashAttachError(`At most ${MAX_ATTACHMENTS} attachments per message.`);
    } else {
      setAttachError(null);
    }
    const chips: AttachedFile[] = picked.map((file) => ({
      id: crypto.randomUUID(),
      kind: "image",
      name: file.name,
      size: file.size,
      file,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...chips]);
    setAttachOpen(false);
    for (const chip of chips) {
      const localFile = chip.file;
      if (!localFile) continue;
      const { promise, abort } = uploadImage(localFile, {
        cloudName: CLOUD_NAME,
        preset: UPLOAD_PRESET,
        onProgress: (pct) =>
          setFiles((prev) =>
            prev.map((f) => (f.id === chip.id ? { ...f, progress: pct } : f))
          ),
      });
      uploadAborts.current.set(chip.id, abort);
      promise.then(
        (done) => {
          uploadAborts.current.delete(chip.id);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === chip.id
                ? { ...f, url: done.url, preview: done.url, progress: 100 }
                : f
            )
          );
          if (!canAttachImages(model.id)) {
            const target = MODELS.find((m) => m.id === IMAGE_TIERS[0]);
            if (target) chooseModel(target);
          }
        },
        (e) => {
          uploadAborts.current.delete(chip.id);
          setFiles((prev) => prev.filter((f) => f.id !== chip.id));
          flashAttachError(e instanceof Error ? e.message : "Upload failed.");
        }
      );
    }
  }

  function switchToImageTier() {
    const target = MODELS.find((m) => m.id === IMAGE_TIERS[0]);
    if (target) chooseModel(target);
    setAttachOpen(false);
  }

  function removeFile(id: string) {
    uploadAborts.current.get(id)?.();
    uploadAborts.current.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
      <div className="relative mx-auto w-full max-w-3xl">
        {files.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 flex flex-wrap gap-1.5 justify-end px-1">
            {files.map((f) => (
              <div key={f.id} className="group relative flex items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-1">
                {f.preview ? (
                  <img
                    src={f.preview}
                    alt={f.name}
                    onClick={() => f.url && onPreview(f.url, f.name)}
                    className="size-8 cursor-zoom-in rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileTypeIcon type={f.kind === "csv" ? "text/csv" : "image/jpeg"} /></span>
                )}
                <div className="max-w-[100px] min-w-0">
                  <p className="truncate text-[11px] font-medium text-foreground">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.kind === "image" && !f.url ? `${f.progress ?? 0}%` : `${(f.size / 1024).toFixed(0)} KB`}</p>
                </div>
                <button
                  onClick={() => removeFile(f.id)}
                  aria-label={`Remove ${f.name}`}
                  className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition group-hover:opacity-100"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {attachError && (
          <p className="px-1 pb-1.5 text-center text-[12px] text-destructive">
            {attachError}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl bg-card border border-border shadow-xl p-1.5 transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_CSV}
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addCsvFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addImageFiles(e.target.files); e.target.value = ""; }}
          />
          <AttachButton
            disabled={sending}
            attachOpen={attachOpen}
            onToggle={() => setAttachOpen((o) => !o)}
            uploadsConfigured={uploadsConfigured}
            photosAllowed={canAttachImages(model.id)}
            switchLabel={imageTierName()}
            onPhoto={() => { setAttachOpen(false); imageInputRef.current?.click(); }}
            onCsv={() => { setAttachOpen(false); fileInputRef.current?.click(); }}
            onSwitch={switchToImageTier}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Glimmer…"
            rows={1}
            disabled={sending}
            className="min-h-[24px] max-h-[144px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-foreground placeholder:text-muted-foreground/60 outline-none py-2 px-1 disabled:opacity-50"
            aria-label="Message input"
          />
          <button
            onClick={() => (sending ? onStop() : onSend())}
            disabled={!sending && (!input.trim() && files.length === 0 || uploading)}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            title={sending ? "Stop" : "Send"}
            aria-label={sending ? "Stop generating" : "Send message"}
          >
            {sending ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
