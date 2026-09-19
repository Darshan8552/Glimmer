import { and, asc, eq, inArray } from "drizzle-orm";
import { requireUserId } from "@/lib/api-auth";
import {
  invalidBody,
  readJsonBody,
  truncateSchema,
} from "@/lib/api-validation";
import { db } from "@/lib/db";
import { conversation, message } from "@/lib/db/schema";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = truncateSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const body = parsed.data;

  const [owned] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .limit(1);

  if (!owned) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, id))
    .orderBy(asc(message.createdAt));

  const index = rows.findIndex((m) => m.id === body.fromMessageId);
  if (index === -1) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const ids = rows.slice(index).map((m) => m.id);
  await db.delete(message).where(inArray(message.id, ids));

  return Response.json({ ok: true, deleted: ids.length });
}
