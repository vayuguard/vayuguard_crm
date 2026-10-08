import { NextRequest } from "next/server";
import { fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  CUSTOMER_EXCEL_HEADERS,
  customerFiltersSchema,
  exportCustomers,
} from "@/server/services/customers.service";
import { searchParamsObject } from "@/lib/validators/common";
import { getClientIp, rateLimit } from "@/server/api/rate-limit";
import { AppError } from "@/server/api/errors";
import {
  buildExcelBuffer,
  buildExcelTemplate,
  excelDownloadResponse,
} from "@/server/lib/excel";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("customers:export");
    const rl = rateLimit(`customers:export:${session.user.id}`, 20, 60_000);
    if (!rl.success) {
      throw new AppError("Too many export requests", 429, "RATE_LIMITED");
    }

    const { searchParams } = request.nextUrl;
    const template = searchParams.get("template") === "1";
    const filters = customerFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const q = searchParams.get("q") ?? undefined;

    if (template) {
      const buffer = buildExcelTemplate(
        [...CUSTOMER_EXCEL_HEADERS],
        "Customers",
      );
      return excelDownloadResponse(buffer, "customers-template.xlsx");
    }

    const rows = await exportCustomers(filters, q);
    const buffer = buildExcelBuffer(rows, "Customers");

    await writeAuditLog({
      action: "CUSTOMER_EXPORT",
      entityType: "Customer",
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { count: rows.length, filters },
    });

    return excelDownloadResponse(
      buffer,
      `customers-export-${Date.now()}.xlsx`,
    );
  } catch (error) {
    return fail(error);
  }
}
