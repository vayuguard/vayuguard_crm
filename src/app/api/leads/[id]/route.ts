import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { teamRecordScope } from "@/server/auth/team-scope";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteLead,
  getLeadById,
  updateLead,
} from "@/server/services/leads.service";
import { updateLeadSchema } from "@/lib/validators/lead";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("leads:read");
    const { id } = await params;
    const lead = await getLeadById(id, (await teamRecordScope(session)));
    return ok(lead);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("leads:write");
    const { id } = await params;
    const body = updateLeadSchema.parse(await request.json());
    const lead = await updateLead(
      id,
      body,
      session.user.id,
      (await teamRecordScope(session)),
    );

    await writeAuditLog({
      action: "LEAD_UPDATE",
      entityType: "Lead",
      entityId: lead.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(lead);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("leads:delete");
    const { id } = await params;
    const lead = await deleteLead(id, session.user.id, (await teamRecordScope(session)));

    await writeAuditLog({
      action: "LEAD_DELETE",
      entityType: "Lead",
      entityId: lead.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { leadNumber: lead.leadNumber },
    });

    return ok(lead);
  } catch (error) {
    return fail(error);
  }
}
