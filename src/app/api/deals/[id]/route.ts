import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteDeal,
  getDealById,
  updateDeal,
  updateDealSchema,
} from "@/server/services/deals.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("deals:read");
    const { id } = await params;
    return ok(await getDealById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("deals:write");
    const { id } = await params;
    const body = updateDealSchema.parse(await request.json());
    const deal = await updateDeal(id, body, session.user.id);

    await writeAuditLog({
      action: "DEAL_UPDATE",
      entityType: "Deal",
      entityId: deal.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(deal);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("deals:delete");
    const { id } = await params;
    const deal = await deleteDeal(id, session.user.id);

    await writeAuditLog({
      action: "DEAL_DELETE",
      entityType: "Deal",
      entityId: deal.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { title: deal.title },
    });

    return ok(deal);
  } catch (error) {
    return fail(error);
  }
}
