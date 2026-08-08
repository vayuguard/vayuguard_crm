import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteQuotation,
  getQuotationById,
  updateQuotation,
} from "@/server/services/quotations.service";
import { updateQuotationSchema } from "@/lib/validators/quotation";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("quotes:read");
    const { id } = await params;
    return ok(await getQuotationById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("quotes:write");
    const { id } = await params;
    const body = updateQuotationSchema.parse(await request.json());
    const quotation = await updateQuotation(id, body, session.user.id);

    await writeAuditLog({
      action: "QUOTATION_UPDATE",
      entityType: "Quotation",
      entityId: quotation.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(quotation);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("quotes:write");
    const { id } = await params;
    const quotation = await deleteQuotation(id, session.user.id);

    await writeAuditLog({
      action: "QUOTATION_DELETE",
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
