import { NextRequest } from "next/server";
import Papa from "papaparse";
import { fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { exportLeads } from "@/server/services/leads.service";
import { leadFiltersSchema } from "@/lib/validators/lead";
import { searchParamsObject } from "@/lib/validators/common";
import { getClientIp, rateLimit } from "@/server/api/rate-limit";
import { AppError } from "@/server/api/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("leads:export");
    const rl = rateLimit(`leads:export:${session.user.id}`, 20, 60_000);
    if (!rl.success) {
      throw new AppError("Too many export requests", 429, "RATE_LIMITED");
    }

    const { searchParams } = request.nextUrl;
    const filters = leadFiltersSchema.parse(searchParamsObject(searchParams));
    const q = searchParams.get("q") ?? undefined;
    const rows = await exportLeads(filters, q);
    const csv = Papa.unparse(rows);

    await writeAuditLog({
      action: "LEAD_EXPORT",
      entityType: "Lead",
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { count: rows.length, filters },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
