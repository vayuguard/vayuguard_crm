import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createLeadActivity,
  listLeadActivities,
} from "@/server/services/leads.service";
import { createLeadActivitySchema } from "@/lib/validators/lead";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("leads:read");
    const { id } = await params;
    const pagination = getPagination(request.nextUrl.searchParams);
    const { items, total } = await listLeadActivities(id, pagination);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("leads:write");
    const { id } = await params;
    const body = createLeadActivitySchema.parse(await request.json());
    const activity = await createLeadActivity(id, body, session.user.id);

    await writeAuditLog({
      action: "LEAD_ACTIVITY_CREATE",
      entityType: "Lead",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { activityId: activity.id, type: activity.type },
    });

    return created(activity);
  } catch (error) {
    return fail(error);
  }
}
