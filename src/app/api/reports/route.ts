import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import {
  reportQuerySchema,
  runReport,
} from "@/server/services/reports.service";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("reports:read");
    const query = reportQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const report = await runReport(query);
    return ok(report);
  } catch (error) {
    return fail(error);
  }
}
