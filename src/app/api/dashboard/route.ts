import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { getDashboardData } from "@/server/services/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("reports:read");
    const scope = request.nextUrl.searchParams.get("scope");
    const data = await getDashboardData({
      userId: session.user.id,
      scopeToUser: scope === "me",
    });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
