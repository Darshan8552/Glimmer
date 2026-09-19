import { count, desc, eq, gte } from "drizzle-orm";
import { adminDenied, checkAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { conversation, message, user } from "@/lib/db/schema";

export async function GET() {
  const check = await checkAdmin();
  if (!check.ok) return adminDenied(check);

  const [[{ n: users }], [{ n: conversations }], [{ n: messages }]] =
    await Promise.all([
      db.select({ n: count() }).from(user),
      db.select({ n: count() }).from(conversation),
      db.select({ n: count() }).from(message),
    ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [perModel, activeRows, recent] = await Promise.all([
    db
      .select({ model: conversation.model, n: count() })
      .from(conversation)
      .groupBy(conversation.model),
    db
      .select({ userId: conversation.userId })
      .from(conversation)
      .where(gte(conversation.updatedAt, weekAgo)),
    db
      .select({
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        updatedAt: conversation.updatedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(conversation)
      .innerJoin(user, eq(conversation.userId, user.id))
      .orderBy(desc(conversation.updatedAt))
      .limit(20),
  ]);

  return Response.json({
    totals: {
      users,
      conversations,
      messages,
      active7d: new Set(activeRows.map((r) => r.userId)).size,
    },
    perModel,
    recent,
  });
}
