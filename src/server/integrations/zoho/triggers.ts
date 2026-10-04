import { enqueueZohoJob } from "@/server/integrations/zoho/queue";

/** Fire-and-forget enqueue helpers — never call Zoho in the request path. */

export function queueCustomerSync(customerId: string) {
  return enqueueZohoJob("sync_customer", { customerId });
}

export function queueQuotationSync(quotationId: string) {
  return enqueueZohoJob("sync_quotation", { quotationId });
}

export function queueInvoiceSync(invoiceId: string) {
  return enqueueZohoJob("sync_invoice", { invoiceId });
}

export function queuePaymentSync(paymentId: string) {
  return enqueueZohoJob("sync_payment", { paymentId });
}

export function queuePullUpdates() {
  return enqueueZohoJob("pull_updates", {});
}
