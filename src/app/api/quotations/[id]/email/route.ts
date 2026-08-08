import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { emailQuotation } from "@/server/services/quotations.service";
import { emailQuotationSchema } from "@/lib/validators/quotation";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("quotes:write");
    const { id } = await params;
    const body = emailQuotationSchema.parse(await request.json());
    const result = await emailQuotation(id, body, session.user.id);

    await writeAuditLog({
      action: "QUOTATION_EMAIL",
      entityType: "Quotation",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { to: body.to, messageId: result.messageId },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
