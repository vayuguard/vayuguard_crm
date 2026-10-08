import {
  ZohoEntityType,
  ZohoQueueStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";

export type ZohoJobType =
  | "sync_customer"
  | "sync_quotation"
  | "sync_invoice"
  | "sync_payment"
  | "pull_updates"
  | "process_webhook";

const OUTBOUND_JOBS = new Set<ZohoJobType>([
  "sync_customer",
  "sync_quotation",
  "sync_invoice",
  "sync_payment",
]);

export function isZohoOutboundJob(jobType: string) {
  return OUTBOUND_JOBS.has(jobType as ZohoJobType);
}

/**
 * Enqueue background work. Outbound CRM→Zoho jobs are never queued
 * (inbound-only mode). Webhooks + pull_updates are allowed when pull is enabled.
 */
export async function enqueueZohoJob(
  jobType: ZohoJobType,
  payload: Record<string, unknown>,
  opts?: { delayMs?: number },
) {
  if (isZohoOutboundJob(jobType)) {
    return null;
  }

  const enabled = await isZohoSyncEnabled();
  if (!enabled && jobType !== "process_webhook") {
    return null;
  }

  const nextRunAt = new Date(Date.now() + (opts?.delayMs ?? 0));
  return prisma.zohoSyncQueue.create({
    data: {
      jobType,
      payload: payload as Prisma.InputJsonValue,
      status: ZohoQueueStatus.pending,
      nextRunAt,
    },
  });
}

export async function getZohoLink(
  entityType: ZohoEntityType,
  crmId: string,
) {
  return prisma.zohoLink.findUnique({
    where: { entityType_crmId: { entityType, crmId } },
  });
}

export async function upsertZohoLink(input: {
  entityType: ZohoEntityType;
  crmId: string;
  zohoId: string;
  zohoLastModified?: Date | null;
}) {
  return prisma.zohoLink.upsert({
    where: {
      entityType_crmId: {
        entityType: input.entityType,
        crmId: input.crmId,
      },
    },
    create: {
      entityType: input.entityType,
      crmId: input.crmId,
      zohoId: input.zohoId,
      zohoLastModified: input.zohoLastModified ?? new Date(),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoId: input.zohoId,
      zohoLastModified: input.zohoLastModified ?? new Date(),
      lastSyncedAt: new Date(),
    },
  });
}

export async function getSyncState(key: string) {
  const row = await prisma.zohoSyncState.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSyncState(key: string, value: string) {
  return prisma.zohoSyncState.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

const MAX_ATTEMPTS = 8;

export function nextBackoffMs(attempts: number) {
  return Math.min(2 ** attempts * 1000, 15 * 60 * 1000);
}

export { MAX_ATTEMPTS };
