import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { bulkUpdateLeads } from "@/server/services/leads.service";
import { bulkUpdateLeadsSchema } from "@/lib/validators/lead";
import { getClientIp } from "@/server/api/rate-limit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission("leads:write");
    const body = bulkUpdateLeadsSchema.parse(await request.json());
    const result = await bulkUpdateLeads(body, session.user.id);

    await writeAuditLog({
      action: "LEAD_BULK_UPDATE",
      entityType: "Lead",
      entityId: undefined,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { ...body, updatedCount: result.updatedCount },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
