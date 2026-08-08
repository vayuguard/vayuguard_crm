import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { createLead, listLeads } from "@/server/services/leads.service";
import { createLeadSchema, leadFiltersSchema } from "@/lib/validators/lead";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("leads:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = leadFiltersSchema.parse(searchParamsObject(searchParams));
    const { items, total } = await listLeads(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("leads:write");
    const body = createLeadSchema.parse(await request.json());
    const lead = await createLead(body, session.user.id);

    await writeAuditLog({
      action: "LEAD_CREATE",
      entityType: "Lead",
      entityId: lead.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { leadNumber: lead.leadNumber },
    });

    return created(lead);
  } catch (error) {
    return fail(error);
  }
}
