import { ZohoEntityType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import {
  createEstimate,
  updateEstimate,
} from "@/server/integrations/zoho/client";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";
import { mapQuotationToZohoEstimate } from "@/server/integrations/zoho/mappers/estimate";
import { syncCustomerToZoho } from "@/server/integrations/zoho/jobs/sync-customer";
import {
  enqueueZohoJob,
  getZohoLink,
  upsertZohoLink,
} from "@/server/integrations/zoho/queue";

export async function syncQuotationToZoho(
  quotationId: string,
  opts?: { force?: boolean },
) {
  if (!opts?.force && !(await isZohoSyncEnabled())) {
    return { skipped: true as const };
  }

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, deletedAt: null },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
  });
  if (!quotation) throw new Error(`Quotation ${quotationId} not found`);
  if (!quotation.customerId) {
    throw new Error("Quotation has no customer — cannot sync");
  }

  let customerLink = await getZohoLink(
    ZohoEntityType.customer,
    quotation.customerId,
  );
  if (!customerLink) {
    await syncCustomerToZoho(quotation.customerId);
    customerLink = await getZohoLink(
      ZohoEntityType.customer,
      quotation.customerId,
    );
  }
  if (!customerLink) {
    await enqueueZohoJob(
      "sync_quotation",
      { quotationId },
      { delayMs: 30_000 },
    );
    return { deferred: true as const };
  }

  const payload = mapQuotationToZohoEstimate(
    quotation,
    customerLink.zohoId,
  );
  const existing = await getZohoLink(ZohoEntityType.quotation, quotationId);

  let zohoId = existing?.zohoId;
  if (zohoId) {
    await updateEstimate(zohoId, payload, quotationId);
  } else {
    const created = await createEstimate(payload, quotationId);
    zohoId = created.estimate.estimate_id;
  }

  await upsertZohoLink({
    entityType: ZohoEntityType.quotation,
    crmId: quotationId,
    zohoId,
  });

  return { zohoId, action: existing ? "updated" : "created" };
}
