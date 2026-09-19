import { and, eq } from "drizzle-orm";
import {
  generateText,
  stepCountIs,
  streamText,
} from "ai";
import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  BYOK_PROVIDERS,
  MODEL_REGISTRY,
  SEARCH_FALLBACK_TIER,
  SEARCH_UNAVAILABLE_PREFIX,
  buildByokSystemPrompt,
  buildSystemPrompt,
  getMaxOutputTokens,
  getModel,
  parseByokModelId,
  searchUnavailableMessage,
  type ModelTier,
} from "@/ai/models";
import { requireUserId } from "@/lib/api-auth";
import { getUserProviderKey } from "@/lib/provider-keys";
import { fetchGroqModels } from "@/lib/groq";
import { fetchOpenRouterFreeModels } from "@/lib/openrouter";
import {
  chatBodySchema,
  invalidBody,
  parseAttachments,
  readJsonBody,
} from "@/lib/api-validation";
import {
  MAX_ATTACHMENTS,
  composeMessageContent,
  composeModelText,
  extractImageUrls,
  isCloudinaryUrl,
  mediaTypeForUrl,
} from "@/lib/attachments";
import { db } from "@/lib/db";
import { conversation, message, user } from "@/lib/db/schema";
import { chatTools } from "@/lib/tools/search";

interface ChatRequestMessage {
  role: string;
  text: string;
}

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

function sanitizeTitle(raw: string): string | null {
  const clean = raw
    .replace(/["'`*_\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\u2026!?:;]+$/, "")
    .slice(0, 60)
    .trim();
  return clean.length > 0 ? clean : null;
}

async function generateAndSaveTitle(
  conversationId: string,
  userId: string,
  firstMessage: string
) {
  try {
    const { text } = await generateText({
      model: getModel("glimmer-3.5"),
      prompt:
        "Summarize the following user message as a short chat title. " +
        "Rules: 5 words or fewer, plain text, no quotes, same language as the message.\n\n" +
        `Message: """${firstMessage.trim().slice(0, 500)}"""`,
      maxOutputTokens: 20,
    });
    const title = sanitizeTitle(text);
    if (!title) return;
    await db
      .update(conversation)
      .set({ title, updatedAt: new Date() })
      .where(
        and(eq(conversation.id, conversationId), eq(conversation.userId, userId))
      );
  } catch (error) {
    console.error("Failed to generate conversation title:", error);
  }
}

export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = chatBodySchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const body = parsed.data;

  const parsedAttachments = parseAttachments(body.attachments, body.model);
  if ("error" in parsedAttachments) {
    return Response.json({ error: parsedAttachments.error }, { status: 400 });
  }
  const attachments = parsedAttachments;

  const validMessages = (body.messages as ChatRequestMessage[]).filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.text === "string" &&
      m.text.trim().length > 0
  );

  if (validMessages.length === 0 && attachments.length === 0) {
    return Response.json({ error: "No valid messages with text found" }, { status: 400 });
  }

  const lastMessage = validMessages.length > 0 ? validMessages[validMessages.length - 1] : null;
  if (lastMessage && lastMessage.role !== "user") {
    return Response.json({ error: "Last message must be from the user" }, { status: 400 });
  }
  const lastText = lastMessage ? lastMessage.text : "";

  let conversationId: string;
  let isNewConversation = false;
  if (typeof body.conversationId === "string" && body.conversationId.length > 0) {
    const [owned] = await db
      .select({ id: conversation.id, model: conversation.model })
      .from(conversation)
      .where(
        and(
          eq(conversation.id, body.conversationId),
          eq(conversation.userId, userId)
        )
      )
      .limit(1);
    if (!owned) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    conversationId = owned.id;
    if (owned.model !== body.model) {
      try {
        await db
          .update(conversation)
          .set({ model: body.model })
          .where(eq(conversation.id, owned.id));
      } catch (error) {
        console.error("Failed to update conversation model:", error);
      }
    }
  } else {
    const title =
      lastText.trim().slice(0, 60) ||
      attachments.map((a) => a.name).join(", ").slice(0, 60) ||
      "New conversation";
    const [row] = await db
      .insert(conversation)
      .values({ userId, title, model: body.model })
      .returning({ id: conversation.id });
    conversationId = row.id;
    isNewConversation = true;
  }

  if (isNewConversation) {
    void generateAndSaveTitle(
      conversationId,
      userId,
      lastText || attachments.map((a) => a.name).join(" ")
    );
  }

  const storedContent = composeMessageContent(lastText, attachments);

  try {
    await db.insert(message).values({
      conversationId,
      role: "user",
      content: storedContent,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Database error";
    return Response.json({ error: `Could not save message: ${detail}` }, { status: 500 });
  }

  try {
    let streamedText = "";
    let savedResponse = false;
    async function saveAssistantResponse(text: string) {
      if (savedResponse) return;
      savedResponse = true;
      try {
        if (text.trim().length > 0) {
          await db.insert(message).values({
            conversationId,
            role: "assistant",
            content: text,
          });
        }
        await db
          .update(conversation)
          .set({ updatedAt: new Date() })
          .where(eq(conversation.id, conversationId));
      } catch (error) {
        console.error("Failed to save assistant message:", error);
      }
    }

    let customPrompt: string | undefined;
    try {
      const [me] = await db
        .select({ systemPrompt: user.systemPrompt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (me?.systemPrompt?.trim()) {
        customPrompt = me.systemPrompt;
      }
    } catch (error) {
      console.error("Failed to load custom instructions:", error);
    }

    let model: LanguageModel;
    let system: string;
    let maxOutputTokens: number;
    let supportsTools = false;
    const byok = parseByokModelId(body.model);
    if (byok) {
      const info = BYOK_PROVIDERS[byok.provider];
      const userKey = await getUserProviderKey(userId, byok.provider);
      if (!userKey) {
        return Response.json(
          { error: `Connect your ${info.label} key in Settings → Providers to use this model.` },
          { status: 400 }
        );
      }
      let catalog: { id: string; name: string; tools?: boolean | null }[];
      try {
        catalog =
          byok.provider === "groq"
            ? (await fetchGroqModels(userKey)).models
            : (await fetchOpenRouterFreeModels()).models;
      } catch {
        return Response.json(
          { error: `Your ${info.label} key was rejected. Check it in Settings → Providers.` },
          { status: 400 }
        );
      }
      const entry = catalog.find((m) => m.id === byok.slug);
      if (!entry) {
        return Response.json(
          { error: `Model ${byok.slug} is no longer available. Pick another from the model menu.` },
          { status: 400 }
        );
      }
      // Groq entries carry no tools flag — assume capable. OpenRouter entries do.
      supportsTools = entry.tools !== false;
      model = createOpenAI({
        baseURL: info.baseURL,
        apiKey: userKey,
      }).chat(byok.slug);
      system = buildByokSystemPrompt(entry.name, customPrompt);
      maxOutputTokens = 4096;
    } else {
      const tier = body.model as ModelTier;
      model = getModel(tier);
      system = buildSystemPrompt(tier, customPrompt);
      maxOutputTokens = getMaxOutputTokens(tier);
      supportsTools = MODEL_REGISTRY[tier]?.supportsTools ?? false;
    }
    if (!supportsTools) {
      system +=
        `\n\nWeb search is unavailable with this model. If the user asks for ` +
        `current or external facts you cannot verify, reply with exactly this ` +
        `sentence and nothing else: "${searchUnavailableMessage()}"`;
    }

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    system += `\n\nToday's date is ${today} (UTC).`;

    const history = (lastMessage ? validMessages.slice(0, -1) : validMessages).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    }));

    const imageUrls: { mediaType: string; url: string }[] = [];
    for (const a of attachments) {
      if (a.kind === "image" && imageUrls.length < MAX_ATTACHMENTS) {
        imageUrls.push({ mediaType: a.mediaType, url: a.url });
      }
    }
    for (const url of extractImageUrls(lastText)) {
      if (imageUrls.length >= MAX_ATTACHMENTS) break;
      if (imageUrls.some((entry) => entry.url === url)) continue;
      const mediaType = mediaTypeForUrl(url);
      if (mediaType && isCloudinaryUrl(url, CLOUDINARY_CLOUD)) {
        imageUrls.push({ mediaType, url });
      }
    }

    const lastContent =
      imageUrls.length > 0
        ? [
            { type: "text" as const, text: composeModelText(lastText, attachments) },
            ...imageUrls.map((entry) => ({
              type: "file" as const,
              mediaType: entry.mediaType,
              data: { type: "url" as const, url: new URL(entry.url) },
            })),
          ]
        : lastText;

    const result = streamText({
      model,
      system,
      messages: [...history, { role: "user" as const, content: lastContent }],
      maxOutputTokens,
      ...(supportsTools ? { tools: chatTools, toolChoice: "auto" as const } : {}),
      stopWhen: stepCountIs(3),
      abortSignal: req.signal,
      onError: ({ error }) => {
        console.error("Chat stream error:", {
          model: body.model,
          conversationId,
          error: error instanceof Error ? error.message : error,
        });
      },
      onChunk: async ({ chunk }) => {
        if (chunk.type === "text-delta") {
          streamedText += chunk.text;
        }
      },
      onFinish: async (event) => {
        if (event.text.trim().length === 0) {
          console.error("Empty stream from model:", {
            model: body.model,
            conversationId,
          });
        }
        await saveAssistantResponse(event.text);
      },
      onAbort: async () => {
        await saveAssistantResponse(streamedText);
      },
    });

    let protocolText = "";
    const protocolStream = result.fullStream.pipeThrough(
      new TransformStream({
        transform(part, controller) {
          if (part.type === "text-delta") {
            protocolText += part.text;
            controller.enqueue(`${JSON.stringify({ t: "text", s: part.text })}\n`);
          } else if (part.type === "tool-call") {
            controller.enqueue(
              `${JSON.stringify({ t: "tool", name: part.toolName, state: "start" })}\n`
            );
          } else if (part.type === "tool-result" || part.type === "tool-error") {
            controller.enqueue(
              `${JSON.stringify({ t: "tool", name: part.toolName, state: "done" })}\n`
            );
          }
        },
        flush(controller) {
          if (
            !supportsTools &&
            protocolText.trim().toLowerCase().startsWith(SEARCH_UNAVAILABLE_PREFIX)
          ) {
            controller.enqueue(
              `${JSON.stringify({ t: "search-unavailable", retryTier: SEARCH_FALLBACK_TIER })}\n`
            );
          }
        },
      })
    );

    return new Response(protocolStream.pipeThrough(new TextEncoderStream()), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Chat request failed";
    return Response.json({ error: detail }, { status: 500 });
  }
}
