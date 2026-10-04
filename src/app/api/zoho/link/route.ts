import { NextRequest } from "next/server";
import { ZohoEntityType } from "@prisma/client";
import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { forbidden } from "@/server/api/errors";
import { prisma } from "@/server/db/client";

const ENTITY_TYPES = new Set(["customer", "quotation", "invoice", "payment"]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const can =
      hasPermission(session.user.permissions, "customers:read") ||
      hasPermission(session.user.permissions, "invoices:read") ||
      hasPermission(session.user.permissions, "settings:read");
    if (!can) throw forbidden();

    const entityType = request.nextUrl.searchParams.get("entityType");
    const crmId = request.nextUrl.searchParams.get("crmId");
    if (!entityType || !crmId || !ENTITY_TYPES.has(entityType)) {
      return ok(null);
    }

    const link = await prisma.zohoLink.findUnique({
      where: {
        entityType_crmId: {
          entityType: entityType as ZohoEntityType,
          crmId,
        },
      },
    });

    const recentLogs = await prisma.zohoSyncLog.findMany({
      where: { entityType: entityType as ZohoEntityType, crmId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        action: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return ok({
      link: link
        ? {
            zohoId: link.zohoId,
            lastSyncedAt: link.lastSyncedAt,
            zohoLastModified: link.zohoLastModified,
          }
        : null,
      recentLogs,
    });
  } catch (error) {
    return fail(error);
  }
}
