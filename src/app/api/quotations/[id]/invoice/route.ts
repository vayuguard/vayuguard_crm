import { NextRequest } from "next/server";
import { z } from "zod";
import { created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { createInvoiceFromQuotation } from "@/server/services/invoices.service";
import { getClientIp } from "@/server/api/rate-limit";
import { emptyToNull, optionalDate } from "@/lib/validators/common";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    dueDate: optionalDate,
    notes: emptyToNull,
  })
  .optional()
  .default({});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission([
      "quotes:read",
      "invoices:write",
    ]);
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const options = bodySchema.parse(json);
    const invoice = await createInvoiceFromQuotation(id, session.user.id, {
      dueDate: options.dueDate ?? undefined,
      notes: options.notes,
    });

    await writeAuditLog({
      action: "QUOTE_TO_INVOICE",
      entityType: "Quotation",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { invoiceId: invoice.id },
    });

    return created(invoice);
  } catch (error) {
    return fail(error);
  }
}