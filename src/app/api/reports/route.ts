import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { teamRecordScope } from "@/server/auth/team-scope";
import {
  reportQuerySchema,
  runReport,
} from "@/server/services/reports.service";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("reports:read");
    const query = reportQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const report = await runReport(query, (await teamRecordScope(session)));
    return ok(report);
  } catch (error) {
    return fail(error);
  }
}
