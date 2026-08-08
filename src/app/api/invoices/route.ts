import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createInvoice,
  listInvoices,
} from "@/server/services/invoices.service";
import {
  createInvoiceSchema,
  invoiceFiltersSchema,
} from "@/lib/validators/invoice";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("invoices:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = invoiceFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listInvoices(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("invoices:write");
    const body = createInvoiceSchema.parse(await request.json());
    const invoice = await createInvoice(body, session.user.id);

    await writeAuditLog({
      action: "INVOICE_CREATE",
      entityType: "Invoice",
      entityId: invoice.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });

    return created(invoice);
  } catch (error) {
    return fail(error);
  }
}
