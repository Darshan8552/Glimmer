import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { adminDenied, checkAdmin } from "@/lib/admin";
import {
  adminUserActionSchema,
  invalidBody,
  readJsonBody,
} from "@/lib/api-validation";

export async function GET(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenied(check);

  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100) ?? "";
  const limit = Math.min(
    Math.max(Number(params.get("limit")) || 20, 1),
    100
  );
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  const result = await auth.api.listUsers({
    query: {
      searchValue: q || undefined,
      searchField: "email",
      searchOperator: "contains",
      limit,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
    headers: await headers(),
  });

  return Response.json(result);
}

export async function POST(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenied(check);

  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = adminUserActionSchema.safeParse(raw.body);
  if (!parsed.success) return invalidBody(parsed.error);
  const body = parsed.data;
  const h = await headers();

  switch (body.action) {
    case "ban":
      await auth.api.banUser({
        body: {
          userId: body.userId,
          banReason: body.banReason,
          banExpiresIn: body.banExpiresIn,
        },
        headers: h,
      });
      break;
    case "unban":
      await auth.api.unbanUser({ body: { userId: body.userId }, headers: h });
      break;
    case "set-role":
      await auth.api.setRole({
        body: { userId: body.userId, role: body.role },
        headers: h,
      });
      break;
    case "remove":
      await auth.api.removeUser({
        body: { userId: body.userId },
        headers: h,
      });
      break;
  }

  return Response.json({ ok: true });
}
