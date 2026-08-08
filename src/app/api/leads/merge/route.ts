import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { mergeLeads } from "@/server/services/leads.service";
import { mergeLeadsSchema } from "@/lib/validators/lead";
import { getClientIp, rateLimit } from "@/server/api/rate-limit";
import { AppError } from "@/server/api/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("leads:write");
    const rl = rateLimit(`leads:merge:${session.user.id}`, 30, 60_000);
    if (!rl.success) {
      throw new AppError("Too many merge requests", 429, "RATE_LIMITED");
    }

    const body = mergeLeadsSchema.parse(await request.json());
    const lead = await mergeLeads(body, session.user.id);

    await writeAuditLog({
      action: "LEAD_MERGE",
      entityType: "Lead",
      entityId: lead.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(lead);
  } catch (error) {
    return fail(error);
  }
}
