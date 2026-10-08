import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { convertContactToLead } from "@/server/services/contacts.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission(["contacts:write", "leads:write"]);
    const { id } = await params;
    const result = await convertContactToLead(id, session.user.id);

    await writeAuditLog({
      action: "CONTACT_TO_LEAD",
      entityType: "Contact",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { leadId: result.lead.id },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
