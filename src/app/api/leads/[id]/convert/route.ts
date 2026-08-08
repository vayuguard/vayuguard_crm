import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { convertLeadToCustomer } from "@/server/services/leads.service";
import { convertLeadSchema } from "@/lib/validators/lead";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission([
      "leads:write",
      "customers:write",
    ]);
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const options = convertLeadSchema.parse(json);
    const result = await convertLeadToCustomer(id, session.user.id, options);

    await writeAuditLog({
      action: "LEAD_CONVERT",
      entityType: "Lead",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        customerId: result.customer.id,
        contactId: result.contact?.id,
      },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
