import { canViewAllTeamRecords } from "@/lib/permissions";
import { forbidden } from "@/server/api/errors";
import { prisma } from "@/server/db/client";

type SessionLike = {
  user: {
    id: string;
    role?: string | null;
    permissions?: string[];
  };
};

export type TeamRecordScope = {
  userId: string;
  seeAll: boolean;
  /** The current user plus everyone who reports to them (direct reports). */
  teamUserIds: string[];
};

export async function getDirectReportIds(managerUserId: string) {
  const reports = await prisma.employeeProfile.findMany({
    where: { managerId: managerUserId, user: { deletedAt: null } },
    select: { userId: true },
  });
  return reports.map((r) => r.userId);
}

/**
 * Admin / Super Admin (or any role with `*` permissions) see all records.
 * Managers see their own records and their direct reports' records.
 * Everyone else sees only records they own (assignee and/or creator, per module).
 */
export async function teamRecordScope(
  session: SessionLike,
): Promise<TeamRecordScope> {
  const userId = session.user.id;
  const seeAll = canViewAllTeamRecords(
    session.user.role,
    session.user.permissions,
  );
  if (seeAll) return { userId, seeAll, teamUserIds: [userId] };

  const reportIds = await getDirectReportIds(userId);
  return {
    userId,
    seeAll,
    teamUserIds: [userId, ...reportIds.filter((id) => id !== userId)],
  };
}

/** Admins may filter by anyone; managers only by people on their team. */
export function canFilterByUser(
  scope: TeamRecordScope | undefined,
  userId: string | undefined,
): userId is string {
  if (!userId) return false;
  if (!scope || scope.seeAll) return true;
  return scope.teamUserIds.includes(userId);
}

type OwnerKey =
  | "assignedToId"
  | "createdById"
  | "ownerId"
  | "uploadedById"
  | "authorId"
  | "organizerId";

function idMatch(ids: string[]) {
  return ids.length === 1 ? ids[0] : { in: ids };
}

/** Prisma ownership filter for the current user's team, or undefined when admin. */
export function mineWhere(
  scope: TeamRecordScope | undefined,
  keys: OwnerKey[],
) {
  if (!scope || scope.seeAll || keys.length === 0) return undefined;
  const match = idMatch(scope.teamUserIds);
  if (keys.length === 1) return { [keys[0]]: match };
  return { OR: keys.map((k) => ({ [k]: match })) };
}

/** Merge ownership into an existing where (uses AND so search ORs stay intact). */
export function applyMineScope<T extends object>(
  where: T,
  scope: TeamRecordScope | undefined,
  keys: OwnerKey[],
): T {
  const mine = mineWhere(scope, keys);
  if (!mine) return where;
  const existingAnd = (where as { AND?: unknown }).AND;
  const andList = Array.isArray(existingAnd)
    ? [...existingAnd]
    : existingAnd
      ? [existingAnd]
      : [];
  andList.push(mine);
  return { ...where, AND: andList };
}

export function assertMine(
  record: Partial<Record<OwnerKey, string | null | undefined>>,
  scope: TeamRecordScope | undefined,
  keys: OwnerKey[],
  message = "You can only access your own records",
) {
  if (!scope || scope.seeAll) return;
  const ok = keys.some((k) => {
    const value = record[k];
    return !!value && scope.teamUserIds.includes(value);
  });
  if (!ok) throw forbidden(message);
}
