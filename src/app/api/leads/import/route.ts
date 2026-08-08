import { NextRequest } from "next/server";
import Papa from "papaparse";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { importLeadsFromRows } from "@/server/services/leads.service";
import { getClientIp, rateLimit } from "@/server/api/rate-limit";
import { AppError, validationError } from "@/server/api/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("leads:import");
    const rl = rateLimit(`leads:import:${session.user.id}`, 10, 60_000);
    if (!rl.success) {
      throw new AppError("Too many import requests", 429, "RATE_LIMITED");
    }

    const contentType = request.headers.get("content-type") ?? "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw validationError("CSV file is required (field name: file)");
      }
      csvText = await file.text();
    } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      csvText = await request.text();
    } else {
      const body = await request.json().catch(() => null);
      if (body && typeof body.csv === "string") {
        csvText = body.csv;
      } else {
        throw validationError(
          "Provide multipart file, text/csv body, or JSON { csv: string }",
        );
      }
    }

    if (!csvText.trim()) {
      throw validationError("CSV content is empty");
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw validationError("Failed to parse CSV", parsed.errors);
    }

    const result = await importLeadsFromRows(parsed.data, session.user.id);

    await writeAuditLog({
      action: "LEAD_IMPORT",
      entityType: "Lead",
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        created: result.created,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
