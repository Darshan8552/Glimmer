import { requireUserId } from "@/lib/api-auth";
import { fetchOpenRouterFreeModels } from "@/lib/openrouter";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { models, fallback } = await fetchOpenRouterFreeModels();
  return Response.json({ models, fallback });
}
