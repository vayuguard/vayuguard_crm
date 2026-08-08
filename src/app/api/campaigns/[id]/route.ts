import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteCampaign,
  getCampaignById,
  updateCampaign,
  updateCampaignMetrics,
} from "@/server/services/campaigns.service";
import {
  updateCampaignMetricsSchema,
  updateCampaignSchema,
} from "@/lib/validators/campaign";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("campaigns:read");
    const { id } = await params;
    return ok(await getCampaignById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("campaigns:write");
    const { id } = await params;
    const raw = await request.json();
    const body = updateCampaignSchema.parse(raw);
    const campaign = await updateCampaign(id, body, session.user.id);

    if (raw.metrics) {
      const metrics = updateCampaignMetricsSchema.parse(raw.metrics);
      await updateCampaignMetrics(id, metrics);
    }

    await writeAuditLog({
      action: "CAMPAIGN_UPDATE",
      entityType: "Campaign",
      entityId: campaign.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(await getCampaignById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("campaigns:write");
    const { id } = await params;
    const campaign = await deleteCampaign(id);

    await writeAuditLog({
      action: "CAMPAIGN_DELETE",
      entityType: "Campaign",
      entityId: campaign.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: campaign.name },
    });

    return ok(campaign);
  } catch (error) {
    return fail(error);
  }
}
