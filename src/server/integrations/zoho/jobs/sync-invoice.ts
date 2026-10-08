import { ZohoEntityType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import {
  createInvoice,
  updateInvoice,
} from "@/server/integrations/zoho/client";
import { isZohoOutboundEnabled } from "@/server/integrations/zoho/config";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";
import { mapInvoiceToZoho } from "@/server/integrations/zoho/mappers/invoice";
import { syncCustomerToZoho } from "@/server/integrations/zoho/jobs/sync-customer";
import {
  enqueueZohoJob,
  getZohoLink,
  upsertZohoLink,
} from "@/server/integrations/zoho/queue";

export async function syncInvoiceToZoho(
  invoiceId: string,
  opts?: { force?: boolean },
) {
  if (!isZohoOutboundEnabled()) {
    return { skipped: true as const, reason: "outbound_disabled" as const };
  }
  if (!opts?.force && !(await isZohoSyncEnabled())) {
    return { skipped: true as const };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  let customerLink = await getZohoLink(
    ZohoEntityType.customer,
    invoice.customerId,
  );
  if (!customerLink) {
    await syncCustomerToZoho(invoice.customerId);
    customerLink = await getZohoLink(
      ZohoEntityType.customer,
      invoice.customerId,
    );
  }
  if (!customerLink) {
    await enqueueZohoJob("sync_invoice", { invoiceId }, { delayMs: 30_000 });
    return { deferred: true as const };
  }

  const payload = mapInvoiceToZoho(invoice, customerLink.zohoId);
  const existing = await getZohoLink(ZohoEntityType.invoice, invoiceId);

  let zohoId = existing?.zohoId;
  if (zohoId) {
    await updateInvoice(zohoId, payload, invoiceId);
  } else {
    const created = await createInvoice(payload, invoiceId);
    zohoId = created.invoice.invoice_id;
  }

  await upsertZohoLink({
    entityType: ZohoEntityType.invoice,
    crmId: invoiceId,
    zohoId,
  });

  return { zohoId, action: existing ? "updated" : "created" };
}
