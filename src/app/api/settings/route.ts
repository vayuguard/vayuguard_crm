import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  getCompanySettings,
  updateCompanySettings,
  updateCompanySettingsSchema,
} from "@/server/services/settings.service";
import { getClientIp } from "@/server/api/rate-limit";

export async function GET() {
  try {
    await requirePermission("settings:read");
    return ok(await getCompanySettings());
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission("settings:write");
    const body = updateCompanySettingsSchema.parse(await request.json());
    const settings = await updateCompanySettings(body);

    await writeAuditLog({
      action: "SETTINGS_UPDATE",
      entityType: "CompanySettings",
      entityId: settings.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue,
    });

    return ok(settings);
  } catch (error) {
    return fail(error);
  }
}
