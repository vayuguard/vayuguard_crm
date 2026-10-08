import { enqueueZohoJob } from "@/server/integrations/zoho/queue";

/**
 * Inbound-only: CRM never pushes records to Zoho.
 * Outbound helpers are intentional no-ops so service call sites stay safe.
 */

export async function queueCustomerSync(customerId: string) {
  void customerId;
  return null;
}

export async function queueQuotationSync(quotationId: string) {
  void quotationId;
  return null;
}

export async function queueInvoiceSync(invoiceId: string) {
  void invoiceId;
  return null;
}

export async function queuePaymentSync(paymentId: string) {
  void paymentId;
  return null;
}

export function queuePullUpdates() {
  return enqueueZohoJob("pull_updates", {});
}
