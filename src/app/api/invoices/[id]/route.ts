import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteInvoice,
  getInvoiceById,
  updateInvoice,
} from "@/server/services/invoices.service";
import { updateInvoiceSchema } from "@/lib/validators/invoice";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("invoices:read");
    const { id } = await params;
    return ok(await getInvoiceById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("invoices:write");
    const { id } = await params;
    const body = updateInvoiceSchema.parse(await request.json());
    const invoice = await updateInvoice(id, body, session.user.id);

    await writeAuditLog({
      action: "INVOICE_UPDATE",
      entityType: "Invoice",
      entityId: invoice.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(invoice);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("invoices:write");
    const { id } = await params;
    const invoice = await deleteInvoice(id, session.user.id);

    await writeAuditLog({
      action: "INVOICE_DELETE",
      entityType: "Invoice",
      entityId: invoice.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });

    return ok(invoice);
  } catch (error) {
    return fail(error);
  }
}
