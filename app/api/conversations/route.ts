import { and, desc, eq, ilike } from "drizzle-orm";
import { requireUserId } from "@/lib/api-auth";
import {
  conversationCreateSchema,
  invalidBody,
  readJsonBody,
} from "@/lib/api-validation";
import { db } from "@/lib/db";
import { conversation } from "@/lib/db/schema";
import { MODEL_REGISTRY } from "@/ai/models";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawQ = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  // Escape LIKE wildcards so the query is a literal substring match.
  const q = rawQ.replace(/[\\%_]/g, (c) => `\\${c}`);

  const rows = await db
    .select({
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      updatedAt: conversation.updatedAt,
      isPinned: conversation.isPinned,
    })
    .from(conversation)
    .where(
      q
        ? and(eq(conversation.userId, userId), ilike(conversation.title, `%${q}%`))
        : eq(conversation.userId, userId)
    )
    .orderBy(desc(conversation.isPinned), desc(conversation.updatedAt))
    .limit(50);

  return Response.json({ conversations: rows });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = conversationCreateSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const body = parsed.data;

  const model = typeof body.model === "string" && body.model in MODEL_REGISTRY
    ? body.model
    : "glimmer-4";
  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 100)
      : "New conversation";

  const [row] = await db
    .insert(conversation)
    .values({ userId, title, model })
    .returning({ id: conversation.id });

  return Response.json({ id: row.id }, { status: 201 });
}
