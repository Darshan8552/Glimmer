import { requireUserId } from "@/lib/api-auth";
import { getUserProviderKey } from "@/lib/provider-keys";
import { fetchGroqModels } from "@/lib/groq";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = await getUserProviderKey(userId, "groq");
  if (!key) {
    return Response.json(
      { error: "Connect your Groq key in Settings → Providers first." },
      { status: 400 }
    );
  }

  try {
    const { models, fallback } = await fetchGroqModels(key);
    return Response.json({
      models: models.map((m) => ({
        ...m,
        free: null,
        inModalities: [],
        outModalities: [],
        tools: null,
      })),
      fallback,
    });
  } catch {
    return Response.json(
      { error: "Key was rejected. Check it in Settings → Providers." },
      { status: 400 }
    );
  }
}
