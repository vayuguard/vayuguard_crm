import { prisma } from "@/server/db/client";
import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { getDirectReportIds } from "@/server/auth/team-scope";

/** People who report to the signed-in user, with a quick workload summary. */
export async function GET() {
  try {
    const session = await requireSession();
    const reportIds = await getDirectReportIds(session.user.id);
    if (!reportIds.length) return ok([]);

    const now = new Date();
    const [users, openLeads, openTasks, overdueTasks] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: reportIds }, deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
      prisma.lead.groupBy({
        by: ["assignedToId"],
        where: {
          assignedToId: { in: reportIds },
          deletedAt: null,
          status: { notIn: ["WON", "LOST"] },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["assignedToId"],
        where: {
          assignedToId: { in: reportIds },
          deletedAt: null,
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["assignedToId"],
        where: {
          assignedToId: { in: reportIds },
          deletedAt: null,
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueAt: { lt: now },
        },
        _count: { _all: true },
      }),
    ]);

    const countFor = (
      rows: { assignedToId: string | null; _count: { _all: number } }[],
      id: string,
    ) => rows.find((r) => r.assignedToId === id)?._count._all ?? 0;

    return ok(
      users.map((u) => ({
        ...u,
        openLeads: countFor(openLeads, u.id),
        openTasks: countFor(openTasks, u.id),
        overdueTasks: countFor(overdueTasks, u.id),
      })),
    );
  } catch (error) {
    return fail(error);
  }
}
