import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { approveQuotation } from "@/server/services/quotations.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("quotes:approve");
    const { id } = await params;
    const quotation = await approveQuotation(id, session.user.id);

    await writeAuditLog({
      action: "QUOTATION_APPROVE",
      entityType: "Quotation",
      entityId: quotation.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { quoteNumber: quotation.quoteNumber },
    });

    return ok(quotation);
  } catch (error) {
    return fail(error);
  }
}
