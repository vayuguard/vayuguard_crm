import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { forbidden } from "@/server/api/errors";
import { hasPermission } from "@/lib/permissions";

/**
 * Lightweight user list for assignment dropdowns (tasks, leads, deals).
 * Available to anyone who can write tasks/leads/deals — not only employees:read.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireSession();
    const perms = session.user.permissions ?? [];
    const canAssign =
      hasPermission(perms, "tasks:write") ||
      hasPermission(perms, "leads:write") ||
      hasPermission(perms, "deals:write") ||
      hasPermission(perms, "employees:read") ||
      hasPermission(perms, "users:manage");

    if (!canAssign) {
      throw forbidden("You do not have permission to list assignees");
    }

    const users = await prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true, slug: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 200,
    });

    return ok(users);
  } catch (error) {
    return fail(error);
  }
}
