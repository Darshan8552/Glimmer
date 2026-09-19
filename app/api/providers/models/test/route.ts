import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireUserId } from "@/lib/api-auth";
import {
  invalidBody,
  providerModelTestSchema,
  readJsonBody,
} from "@/lib/api-validation";
import { getUserProviderKey } from "@/lib/provider-keys";
import { fetchGroqModels } from "@/lib/groq";
import { fetchOpenRouterFreeModels } from "@/lib/openrouter";
import { BYOK_PROVIDERS } from "@/ai/models";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = providerModelTestSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const { provider, model: slug, custom } = parsed.data;
  const info = BYOK_PROVIDERS[provider];

  const key = await getUserProviderKey(userId, provider);
  if (!key) {
    return Response.json(
      { error: `Connect your ${info.label} key first.` },
      { status: 400 }
    );
  }

  try {
    const catalog =
      provider === "groq"
        ? (await fetchGroqModels(key)).models
        : (await fetchOpenRouterFreeModels()).models;
    if (!catalog.some((m) => m.id === slug) && !custom) {
      return Response.json(
        { error: `Model ${slug} is not available.` },
        { status: 400 }
      );
    }
  } catch {
    return Response.json(
      { error: `Your ${info.label} key was rejected. Check it and try again.` },
      { status: 400 }
    );
  }

  const started = Date.now();
  try {
    const { text } = await generateText({
      model: createOpenAI({ baseURL: info.baseURL, apiKey: key }).chat(slug),
      prompt: "Reply with exactly: ok",
      maxOutputTokens: 5,
      abortSignal: AbortSignal.timeout(25000),
    });
    if (text.trim().length === 0) {
      return Response.json(
        { ok: false, error: "Model returned nothing." },
        { status: 502 }
      );
    }
    return Response.json({ ok: true, ms: Date.now() - started, sample: text.slice(0, 200) });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Model test failed";
    return Response.json({ ok: false, error: detail.slice(0, 300) }, { status: 502 });
  }
}
