import { NextRequest } from "next/server";
import { ZohoQueueStatus, ZohoSyncStatus } from "@prisma/client";
import { ok, fail } from "@/server/api/response";
import { validationError } from "@/server/api/errors";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { getZohoConfig } from "@/server/integrations/zoho/config";
import {
  isZohoSyncEnabled,
  setZohoSyncEnabled,
} from "@/server/integrations/zoho/sync-enabled";
import { getOrganization } from "@/server/integrations/zoho/client";
import { getSyncState } from "@/server/integrations/zoho/queue";

export async function GET() {
  try {
    await requirePermission("settings:read");
    const cfg = getZohoConfig();
    const syncEnabled = await isZohoSyncEnabled();

    const [pending, succeeded, failed, dead, lastSuccess, lastError] =
      await Promise.all([
        prisma.zohoSyncQueue.count({
          where: { status: ZohoQueueStatus.pending },
        }),
        prisma.zohoSyncQueue.count({
          where: { status: ZohoQueueStatus.succeeded },
        }),
        prisma.zohoSyncQueue.count({
          where: { status: ZohoQueueStatus.failed },
        }),
        prisma.zohoSyncQueue.count({
          where: { status: ZohoQueueStatus.dead },
        }),
        prisma.zohoSyncLog.findFirst({
          where: { status: ZohoSyncStatus.success },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, action: true },
        }),
        prisma.zohoSyncLog.findFirst({
          where: { status: ZohoSyncStatus.failed },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, action: true, errorMessage: true },
        }),
      ]);

    const failedJobs = await prisma.zohoSyncQueue.findMany({
      where: {
        status: { in: [ZohoQueueStatus.failed, ZohoQueueStatus.dead] },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    let connection: { ok: boolean; organizationName?: string; error?: string } =
      { ok: false };
    if (cfg.clientId && cfg.refreshToken && cfg.organizationId) {
      try {
        const org = await getOrganization();
        const name =
          (org.organization as { name?: string } | undefined)?.name ??
          (org.organizations?.[0] as { name?: string } | undefined)?.name;
        connection = { ok: true, organizationName: name };
      } catch (error) {
        connection = {
          ok: false,
          error: error instanceof Error ? error.message : "connection failed",
        };
      }
    } else {
      connection = { ok: false, error: "Credentials incomplete" };
    }

    return ok({
      syncEnabled,
      syncEnabledEnv: cfg.syncEnabledEnv,
      dc: cfg.dc,
      organizationId: cfg.organizationId ? "***" + cfg.organizationId.slice(-4) : "",
      connection,
      counters: { pending, succeeded, failed, dead },
      lastSuccess,
      lastError,
      pollCursors: {
        invoices: await getSyncState("invoices_last_modified"),
        payments: await getSyncState("payments_last_modified"),
      },
      failedJobs: failedJobs.map((j) => ({
        id: j.id,
        jobType: j.jobType,
        status: j.status,
        attempts: j.attempts,
        lastError: j.lastError,
        payload: j.payload,
        updatedAt: j.updatedAt,
        createdAt: j.createdAt,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePermission("settings:write");
    const body = (await request.json()) as { syncEnabled?: boolean };
    if (typeof body.syncEnabled !== "boolean") {
      throw validationError("syncEnabled boolean required");
    }
    await setZohoSyncEnabled(body.syncEnabled);
    return ok({ syncEnabled: body.syncEnabled });
  } catch (error) {
    return fail(error);
  }
}
