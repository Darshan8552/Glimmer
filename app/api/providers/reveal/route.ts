import { requireUserId } from "@/lib/api-auth";
import {
  invalidBody,
  providerSchema,
  readJsonBody,
} from "@/lib/api-validation";
import {
  getUserProviderKey,
  isSupportedProvider,
} from "@/lib/provider-keys";

export async function POST(req: Request) {
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

  const key = await getUserProviderKey(userId, parsed.data.provider);
  if (!key) {
    return Response.json({ error: "No key saved for this provider." }, { status: 404 });
  }
  return Response.json({ key });
}
