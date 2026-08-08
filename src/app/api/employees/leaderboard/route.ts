import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { getEmployeeLeaderboard } from "@/server/services/employees.service";
import { z } from "zod";
import { searchParamsObject } from "@/lib/validators/common";

const leaderboardQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission("employees:read");
    const query = leaderboardQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const rows = await getEmployeeLeaderboard(query);
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
