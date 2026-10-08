import { enqueueZohoJob } from "@/server/integrations/zoho/queue";

/**
 * Inbound-only: CRM never pushes records to Zoho.
 * Outbound helpers are intentional no-ops so service call sites stay safe.
 */

export async function queueCustomerSync(_customerId: string) {
  return null;
}

export async function queueQuotationSync(_quotationId: string) {
  return null;
}

export async function queueInvoiceSync(_invoiceId: string) {
  return null;
}

export async function queuePaymentSync(_paymentId: string) {
  return null;
}

export function queuePullUpdates() {
  return enqueueZohoJob("pull_updates", {});
}
