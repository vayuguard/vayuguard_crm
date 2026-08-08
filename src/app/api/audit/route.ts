import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import {
  auditFiltersSchema,
  listAuditLogs,
} from "@/server/services/audit.service";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = auditFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listAuditLogs(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}
