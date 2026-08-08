import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createCampaign,
  listCampaigns,
} from "@/server/services/campaigns.service";
import {
  campaignFiltersSchema,
  createCampaignSchema,
} from "@/lib/validators/campaign";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("campaigns:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = campaignFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listCampaigns(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("campaigns:write");
    const body = createCampaignSchema.parse(await request.json());
    const campaign = await createCampaign(body, session.user.id);

    await writeAuditLog({
      action: "CAMPAIGN_CREATE",
      entityType: "Campaign",
      entityId: campaign.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: campaign.name },
    });

    return created(campaign);
  } catch (error) {
    return fail(error);
  }
}
