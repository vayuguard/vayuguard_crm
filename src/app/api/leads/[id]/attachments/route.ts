import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createLeadAttachment,
  getLeadById,
} from "@/server/services/leads.service";
import { createLeadAttachmentSchema } from "@/lib/validators/lead";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("leads:read");
    const { id } = await params;
    const lead = await getLeadById(id);
    return ok(lead.attachments ?? []);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("leads:write");
    const { id } = await params;
    const body = createLeadAttachmentSchema.parse(await request.json());
    const attachment = await createLeadAttachment(id, body, session.user.id);

    await writeAuditLog({
      action: "LEAD_ATTACHMENT_CREATE",
      entityType: "LeadAttachment",
      entityId: attachment.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { leadId: id, fileName: attachment.fileName },
    });

    return created(attachment);
  } catch (error) {
    return fail(error);
  }
}
