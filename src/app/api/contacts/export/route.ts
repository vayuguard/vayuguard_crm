import { NextRequest } from "next/server";
import { fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  CONTACT_EXCEL_HEADERS,
  contactFiltersSchema,
  exportContacts,
} from "@/server/services/contacts.service";
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
    const session = await requirePermission("contacts:export");
    const rl = rateLimit(`contacts:export:${session.user.id}`, 20, 60_000);
    if (!rl.success) {
      throw new AppError("Too many export requests", 429, "RATE_LIMITED");
    }

    const { searchParams } = request.nextUrl;
    const template = searchParams.get("template") === "1";
    const filters = contactFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const q = searchParams.get("q") ?? undefined;

    if (template) {
      const buffer = buildExcelTemplate([...CONTACT_EXCEL_HEADERS], "Contacts");
      return excelDownloadResponse(buffer, "contacts-template.xlsx");
    }

    const rows = await exportContacts(filters, q);
    const buffer = buildExcelBuffer(rows, "Contacts");

    await writeAuditLog({
      action: "CONTACT_EXPORT",
      entityType: "Contact",
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { count: rows.length, filters },
    });

    return excelDownloadResponse(
      buffer,
      `contacts-export-${Date.now()}.xlsx`,
    );
  } catch (error) {
    return fail(error);
  }
}
