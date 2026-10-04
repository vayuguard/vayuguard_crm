import { NextRequest } from "next/server";
import { ZohoQueueStatus } from "@prisma/client";
import { z } from "zod";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { enqueueZohoJob, type ZohoJobType } from "@/server/integrations/zoho/queue";
import { validationError } from "@/server/api/errors";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry"), jobId: z.string().cuid() }),
  z.object({ action: z.literal("retry_all") }),
  z.object({
    action: z.literal("sync_now"),
    entityType: z.enum(["customer", "quotation", "invoice", "payment"]),
    crmId: z.string().cuid(),
  }),
  z.object({ action: z.literal("pull_now") }),
]);

export async function POST(request: NextRequest) {
  try {
    await requirePermission("settings:write");
    const body = bodySchema.parse(await request.json());

    if (body.action === "retry") {
      const job = await prisma.zohoSyncQueue.findUnique({
        where: { id: body.jobId },
      });
      if (!job) throw validationError("Job not found");
      await prisma.zohoSyncQueue.update({
        where: { id: body.jobId },
        data: {
          status: ZohoQueueStatus.pending,
          nextRunAt: new Date(),
          lastError: null,
        },
      });
      return ok({ retried: 1 });
    }

    if (body.action === "retry_all") {
      const result = await prisma.zohoSyncQueue.updateMany({
        where: {
          status: { in: [ZohoQueueStatus.failed, ZohoQueueStatus.dead] },
        },
        data: {
          status: ZohoQueueStatus.pending,
          nextRunAt: new Date(),
          attempts: 0,
          lastError: null,
        },
      });
      return ok({ retried: result.count });
    }

    if (body.action === "pull_now") {
      const job = await enqueueZohoJob("pull_updates", {});
      return ok({ jobId: job?.id ?? null });
    }

    const map: Record<string, ZohoJobType> = {
      customer: "sync_customer",
      quotation: "sync_quotation",
      invoice: "sync_invoice",
      payment: "sync_payment",
    };
    const jobType = map[body.entityType]!;
    const payloadKey =
      body.entityType === "customer"
        ? "customerId"
        : body.entityType === "quotation"
          ? "quotationId"
          : body.entityType === "invoice"
            ? "invoiceId"
            : "paymentId";

    // Force enqueue even if sync disabled — admin explicit action
    const job = await prisma.zohoSyncQueue.create({
      data: {
        jobType,
        payload: { [payloadKey]: body.crmId, force: true },
        status: ZohoQueueStatus.pending,
        nextRunAt: new Date(),
      },
    });
    return ok({ jobId: job.id });
  } catch (error) {
    return fail(error);
  }
}
