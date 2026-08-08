import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createQuotation,
  listQuotations,
} from "@/server/services/quotations.service";
import {
  createQuotationSchema,
  quotationFiltersSchema,
} from "@/lib/validators/quotation";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("quotes:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = quotationFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listQuotations(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("quotes:write");
    const body = createQuotationSchema.parse(await request.json());
    const quotation = await createQuotation(body, session.user.id);

    await writeAuditLog({
      action: "QUOTATION_CREATE",
      entityType: "Quotation",
      entityId: quotation.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { quoteNumber: quotation.quoteNumber },
    });

    return created(quotation);
  } catch (error) {
    return fail(error);
  }
}
