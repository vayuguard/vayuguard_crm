import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { moveDeal, moveDealSchema } from "@/server/services/deals.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("deals:write");
    const { id } = await params;
    const body = moveDealSchema.parse(await request.json());
    const deal = await moveDeal(id, body, session.user.id);

    await writeAuditLog({
      action: "DEAL_MOVE",
      entityType: "Deal",
      entityId: deal.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { stageId: body.stageId, position: body.position },
    });

    return ok(deal);
  } catch (error) {
    return fail(error);
  }
}
