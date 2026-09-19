import { z } from "zod";
import {
  MODEL_REGISTRY,
  isByokModelId,
  imageTierName,
  type ModelTier,
} from "@/ai/models";
import {
  MAX_ATTACHMENTS,
  MAX_CSV_CHARS,
  isCloudinaryUrl,
  mediaTypeForUrl,
  type ChatAttachment,
} from "@/lib/attachments";

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function readJsonBody(
  req: Request
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: badRequest("Invalid JSON body") };
  }
}

export function invalidBody(error: z.ZodError) {
  return badRequest(error.issues[0]?.message ?? "Invalid request");
}

function isModelTier(value: unknown): value is ModelTier {
  return typeof value === "string" && value in MODEL_REGISTRY;
}

export function isChatModel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (isModelTier(value) || isByokModelId(value))
  );
}

const modelSchema = z.custom<string>(
  (v) => isChatModel(v),
  `Unknown model. Use a Glimmer tier (${Object.keys(MODEL_REGISTRY).join(", ")}) or a connected provider model (<provider>:<id>).`
);

export const chatBodySchema = z.object({
  model: modelSchema,
  messages: z.array(z.unknown(), { error: "messages must be an array" }),
  conversationId: z.string().optional(),
  attachments: z.array(z.unknown()).optional(),
});

export const conversationCreateSchema = z.object({
  title: z.unknown().optional(),
  model: z.unknown().optional(),
});

export const conversationUpdateSchema = z
  .object({
    title: z
      .string({ error: "Title must be 1-100 characters" })
      .trim()
      .min(1, "Title must be 1-100 characters")
      .max(100, "Title must be 1-100 characters")
      .optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.isPinned !== undefined, {
    error: "Nothing to update",
  });

export const settingsSchema = z.object({
  systemPrompt: z.string({ error: "systemPrompt must be a string" }),
});

export const truncateSchema = z.object({
  fromMessageId: z
    .string({ error: "fromMessageId is required" })
    .min(1, "fromMessageId is required"),
});

export const providerSchema = z.object({
  provider: z.enum(["openrouter", "groq"]),
});

export const providerKeySchema = z.object({
  provider: z.enum(["openrouter", "groq"]),
  key: z
    .string({ error: "Key is required" })
    .trim()
    .min(8, "Key looks too short")
    .max(500, "Key looks too long"),
});

export const providerModelTestSchema = z.object({
  provider: z.enum(["openrouter", "groq"]),
  model: z
    .string({ error: "Model is required" })
    .trim()
    .min(3, "Model is required")
    .max(200, "Model is required"),
  custom: z.boolean().optional(),
});

export const adminUserActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ban"),
    userId: z.string().min(1, "userId is required"),
    banReason: z.string().max(500).optional(),
    banExpiresIn: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("unban"),
    userId: z.string().min(1, "userId is required"),
  }),
  z.object({
    action: z.literal("set-role"),
    userId: z.string().min(1, "userId is required"),
    role: z.enum(["admin", "user"]),
  }),
  z.object({
    action: z.literal("remove"),
    userId: z.string().min(1, "userId is required"),
  }),
]);

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

// Domain policy: capability gating + Cloudinary URL checks can't be declarative,
// so attachment validation stays hand-rolled (moved verbatim from the chat route).
export function parseAttachments(value: unknown, tier: string): ChatAttachment[] | { error: string } {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    return { error: "attachments must be an array" };
  }
  if (value.length > MAX_ATTACHMENTS) {
    return { error: `At most ${MAX_ATTACHMENTS} attachments per message` };
  }
  const caps = MODEL_REGISTRY[tier as ModelTier]?.capabilities ?? {
    images: [],
    textFiles: true,
  };
  const out: ChatAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { error: "Invalid attachment" };
    }
    const record = item as Record<string, unknown>;
    if (record.kind === "image") {
      if (
        typeof record.name !== "string" ||
        record.name.trim().length === 0 ||
        record.name.length > 200 ||
        typeof record.mediaType !== "string" ||
        !(caps.images as readonly string[]).includes(record.mediaType) ||
        typeof record.url !== "string"
      ) {
        return { error: `Images need ${imageTierName()}` };
      }
      let imageUrl: string;
      try {
        if (
          typeof record.url !== "string" ||
          !isCloudinaryUrl(record.url, CLOUDINARY_CLOUD) ||
          mediaTypeForUrl(record.url) !== record.mediaType
        ) {
          return { error: "Invalid image URL" };
        }
        imageUrl = record.url;
      } catch {
        return { error: "Invalid image URL" };
      }
      out.push({
        kind: "image",
        name: record.name.trim(),
        mediaType: record.mediaType,
        url: imageUrl,
      });
    } else if (record.kind === "csv") {
      if (
        !caps.textFiles ||
        typeof record.name !== "string" ||
        record.name.trim().length === 0 ||
        record.name.length > 200 ||
        typeof record.text !== "string"
      ) {
        return { error: "Invalid CSV attachment" };
      }
      if (record.text.length > MAX_CSV_CHARS) {
        return {
          error: `CSV text must be ${MAX_CSV_CHARS} characters or fewer`,
        };
      }
      out.push({ kind: "csv", name: record.name.trim(), text: record.text });
    } else {
      return { error: "Unknown attachment kind" };
    }
  }
  return out;
}
