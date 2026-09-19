import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/api-auth";
import {
  conversationUpdateSchema,
  invalidBody,
  readJsonBody,
} from "@/lib/api-validation";
import { db } from "@/lib/db";
import { conversation } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select({
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    })
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .limit(1);

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ conversation: row });
}

export async function PATCH(
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
  const parsed = conversationUpdateSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const set: { title?: string; isPinned?: boolean } = {};
  if (parsed.data.title !== undefined) set.title = parsed.data.title;
  if (parsed.data.isPinned !== undefined) set.isPinned = parsed.data.isPinned;

  const [updated] = await db
    .update(conversation)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .returning({ id: conversation.id, title: conversation.title, isPinned: conversation.isPinned });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ conversation: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await db
    .delete(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .returning({ id: conversation.id });

  if (deleted.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
