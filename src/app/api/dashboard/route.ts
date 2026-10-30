import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { teamRecordScope } from "@/server/auth/team-scope";
import { getDashboardData } from "@/server/services/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const scope = request.nextUrl.searchParams.get("scope");
    const team = await teamRecordScope(session);
    // Employees always scoped (managers: self + direct reports); admins can use ?scope=me
    const personal = !team.seeAll || scope === "me";
    const data = await getDashboardData({
      userId: session.user.id,
      userIds: scope === "me" ? [session.user.id] : team.teamUserIds,
      scopeToUser: personal,
      scopePersonalSchedule: personal,
    });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
