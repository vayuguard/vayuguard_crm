import { ZohoEntityType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { createCustomerPayment } from "@/server/integrations/zoho/client";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";
import { mapPaymentToZoho } from "@/server/integrations/zoho/mappers/payment";
import { syncInvoiceToZoho } from "@/server/integrations/zoho/jobs/sync-invoice";
import {
  enqueueZohoJob,
  getZohoLink,
  upsertZohoLink,
} from "@/server/integrations/zoho/queue";

export async function syncPaymentToZoho(
  paymentId: string,
  opts?: { force?: boolean },
) {
  if (!opts?.force && !(await isZohoSyncEnabled())) {
    return { skipped: true as const };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw new Error(`Payment ${paymentId} not found`);

  let invoiceLink = await getZohoLink(
    ZohoEntityType.invoice,
    payment.invoiceId,
  );
  if (!invoiceLink) {
    await syncInvoiceToZoho(payment.invoiceId);
    invoiceLink = await getZohoLink(ZohoEntityType.invoice, payment.invoiceId);
  }
  if (!invoiceLink) {
    await enqueueZohoJob("sync_payment", { paymentId }, { delayMs: 45_000 });
    return { deferred: true as const };
  }

  let customerLink = await getZohoLink(
    ZohoEntityType.customer,
    payment.customerId,
  );
  if (!customerLink) {
    await enqueueZohoJob("sync_payment", { paymentId }, { delayMs: 45_000 });
    return { deferred: true as const };
  }

  const existing = await getZohoLink(ZohoEntityType.payment, paymentId);
  if (existing?.zohoId) {
    // Zoho customer payments are typically immutable after create — skip update.
    return { zohoId: existing.zohoId, action: "exists" as const };
  }

  const payload = mapPaymentToZoho(
    payment,
    customerLink.zohoId,
    invoiceLink.zohoId,
  );
  const created = await createCustomerPayment(payload, paymentId);
  const zohoId = String(
    created.payment?.payment_id ??
      (created as { customerpayment?: { payment_id?: string } }).customerpayment
        ?.payment_id ??
      "",
  );
  if (!zohoId) {
    throw new Error("Zoho did not return a payment_id");
  }

  await upsertZohoLink({
    entityType: ZohoEntityType.payment,
    crmId: paymentId,
    zohoId,
  });

  return { zohoId, action: "created" as const };
}
