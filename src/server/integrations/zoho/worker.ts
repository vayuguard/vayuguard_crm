import { ZohoQueueStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { syncCustomerToZoho } from "@/server/integrations/zoho/jobs/sync-customer";
import { syncInvoiceToZoho } from "@/server/integrations/zoho/jobs/sync-invoice";
import { syncPaymentToZoho } from "@/server/integrations/zoho/jobs/sync-payment";
import { syncQuotationToZoho } from "@/server/integrations/zoho/jobs/sync-quotation";
import { pullZohoUpdates } from "@/server/integrations/zoho/jobs/pull-updates";
import { processZohoWebhook } from "@/server/integrations/zoho/jobs/process-webhook";
import {
  MAX_ATTEMPTS,
  nextBackoffMs,
} from "@/server/integrations/zoho/queue";

export async function processZohoQueueBatch(limit = 20) {
  const jobs = await prisma.zohoSyncQueue.findMany({
    where: {
      status: { in: [ZohoQueueStatus.pending, ZohoQueueStatus.failed] },
      nextRunAt: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const job of jobs) {
    await prisma.zohoSyncQueue.update({
      where: { id: job.id },
      data: { status: ZohoQueueStatus.processing },
    });

    try {
      const payload = job.payload as Record<string, unknown>;
      const force = payload.force === true;
      switch (job.jobType) {
        case "sync_customer":
          await syncCustomerToZoho(String(payload.customerId), { force });
          break;
        case "sync_quotation":
          await syncQuotationToZoho(String(payload.quotationId), { force });
          break;
        case "sync_invoice":
          await syncInvoiceToZoho(String(payload.invoiceId), { force });
          break;
        case "sync_payment":
          await syncPaymentToZoho(String(payload.paymentId), { force });
          break;
        case "pull_updates":
          await pullZohoUpdates();
          break;
        case "process_webhook":
          await processZohoWebhook(
            (payload.body as Record<string, unknown>) ?? payload,
          );
          break;
        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }

      await prisma.zohoSyncQueue.update({
        where: { id: job.id },
        data: {
          status: ZohoQueueStatus.succeeded,
          lastError: null,
          attempts: job.attempts + 1,
        },
      });
      processed += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const message =
        error instanceof Error ? error.message : "Unknown Zoho job error";
      const dead = attempts >= MAX_ATTEMPTS;
      await prisma.zohoSyncQueue.update({
        where: { id: job.id },
        data: {
          status: dead ? ZohoQueueStatus.dead : ZohoQueueStatus.failed,
          attempts,
          lastError: message.slice(0, 2000),
          nextRunAt: new Date(Date.now() + nextBackoffMs(attempts)),
        },
      });
    }
  }

  return { claimed: jobs.length, processed };
}

/** Long-running worker loop for PM2 / systemd. */
export async function runZohoWorkerLoop(intervalMs = 5000) {
  console.log(`[zoho-worker] started (interval ${intervalMs}ms)`);
  for (;;) {
    try {
      const result = await processZohoQueueBatch();
      if (result.claimed > 0) {
        console.log(
          `[zoho-worker] claimed=${result.claimed} processed=${result.processed}`,
        );
      }
    } catch (error) {
      console.error("[zoho-worker] batch error", error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
