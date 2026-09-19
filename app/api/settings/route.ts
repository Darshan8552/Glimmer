import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/api-auth";
import {
  invalidBody,
  readJsonBody,
  settingsSchema,
} from "@/lib/api-validation";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import {
  SYSTEM_PROMPT_MAX_LENGTH,
  normalizeSystemPrompt,
} from "@/lib/settings";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({ systemPrompt: user.systemPrompt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ systemPrompt: row.systemPrompt ?? "" });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = settingsSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const body = parsed.data;

  const normalized = normalizeSystemPrompt(body.systemPrompt);
  if (normalized.length > SYSTEM_PROMPT_MAX_LENGTH) {
    return Response.json(
      { error: `System prompt must be ${SYSTEM_PROMPT_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(user)
    .set({ systemPrompt: normalized.length > 0 ? normalized : null })
    .where(eq(user.id, userId))
    .returning({ id: user.id });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ systemPrompt: normalized });
}
