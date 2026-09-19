import { requireUserId } from "@/lib/api-auth";
import {
  invalidBody,
  providerKeySchema,
  readJsonBody,
} from "@/lib/api-validation";
import { testGroqKey } from "@/lib/groq";
import { testOpenRouterKey } from "@/lib/openrouter";

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

  if (provider === "groq") {
    const result = await testGroqKey(key);
    if (!result.valid) {
      return Response.json({ valid: false, error: result.error }, { status: 400 });
    }
    return Response.json({ valid: true, label: "Groq key", provider });
  }

  const result = await testOpenRouterKey(key);
  if (!result.valid) {
    return Response.json({ valid: false, error: result.error }, { status: 400 });
  }
  return Response.json({ valid: true, label: result.label, provider });
}
