import { headers } from "next/headers";
import { auth } from "./auth";

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 };

export async function checkAdmin(): Promise<AdminCheck> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return { ok: false, status: 401 };
  const role = (session.user as { role?: unknown }).role;
  if (role !== "admin") return { ok: false, status: 403 };
  return { ok: true, userId: session.user.id };
}

export function adminDenied(check: Extract<AdminCheck, { ok: false }>) {
  return Response.json(
    { error: check.status === 401 ? "Unauthorized" : "Forbidden" },
    { status: check.status }
  );
}
