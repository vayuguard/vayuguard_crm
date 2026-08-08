import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createDeal,
  createDealSchema,
  dealFiltersSchema,
  listDeals,
} from "@/server/services/deals.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("deals:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = dealFiltersSchema.parse(searchParamsObject(searchParams));
    const { items, total } = await listDeals(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("deals:write");
    const body = createDealSchema.parse(await request.json());
    const deal = await createDeal(body, session.user.id);

    await writeAuditLog({
      action: "DEAL_CREATE",
      entityType: "Deal",
      entityId: deal.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { title: deal.title, stageId: deal.stageId },
    });

    return created(deal);
  } catch (error) {
    return fail(error);
  }
}
