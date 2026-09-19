import { requireUserId } from "@/lib/api-auth";
import {
  invalidBody,
  providerKeySchema,
  providerSchema,
  readJsonBody,
} from "@/lib/api-validation";
import {
  SUPPORTED_PROVIDERS,
  deleteUserProviderKey,
  getUserProviderMasked,
  getUserProviderMeta,
  isSupportedProvider,
  saveUserProviderKey,
} from "@/lib/provider-keys";
import { testGroqKey } from "@/lib/groq";
import { testOpenRouterKey } from "@/lib/openrouter";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providers = await Promise.all(
    SUPPORTED_PROVIDERS.map(async (provider) => {
      try {
        const meta = await getUserProviderMeta(userId, provider);
        if (!meta) return { provider, connected: false, masked: null, length: null };
        return { provider, connected: true, masked: meta.masked, length: meta.length };
      } catch (error) {
        console.error(`providers: status check failed for ${provider}`, error);
        return { provider, connected: false, masked: null, length: null };
      }
    })
  );

  return Response.json({ providers });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = providerKeySchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const { provider, key } = parsed.data;

  const check =
    provider === "groq" ? await testGroqKey(key) : await testOpenRouterKey(key);
  if (!check.valid) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  try {
    await saveUserProviderKey(userId, provider, key);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not save key";
    return Response.json({ error: detail }, { status: 500 });
  }

  const masked = await getUserProviderMasked(userId, provider);
  return Response.json({ provider, connected: true, masked, length: key.length });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = providerSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  if (!isSupportedProvider(parsed.data.provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }

  await deleteUserProviderKey(userId, parsed.data.provider);
  return Response.json({ ok: true });
}
