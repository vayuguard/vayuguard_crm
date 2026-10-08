import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { importContactsFromRows } from "@/server/services/contacts.service";
import { getClientIp, rateLimit } from "@/server/api/rate-limit";
import { AppError, validationError } from "@/server/api/errors";
import { parseExcelBuffer, readUploadBuffer } from "@/server/lib/excel";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("contacts:import");
    const rl = rateLimit(`contacts:import:${session.user.id}`, 10, 60_000);
    if (!rl.success) {
      throw new AppError("Too many import requests", 429, "RATE_LIMITED");
    }

    let buffer: Buffer;
    try {
      buffer = await readUploadBuffer(request);
    } catch (error) {
      throw validationError(
        error instanceof Error ? error.message : "Invalid upload",
      );
    }

    const rows = parseExcelBuffer(buffer);
    if (!rows.length) {
      throw validationError("Excel file has no data rows");
    }

    const result = await importContactsFromRows(rows, session.user.id);

    await writeAuditLog({
      action: "CONTACT_IMPORT",
      entityType: "Contact",
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
