import {
  PaymentStatus,
  ZohoEntityType,
  ZohoSyncDirection,
  ZohoSyncStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { getInvoice } from "@/server/integrations/zoho/client";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import { upsertZohoLink } from "@/server/integrations/zoho/queue";

type WebhookPayload = {
  event?: string;
  event_type?: string;
  invoice?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  customerpayment?: Record<string, unknown>;
  invoice_id?: string;
  payment_id?: string;
  [key: string]: unknown;
};

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Apply Zoho → CRM webhook payload (invoice / payment events).
 * Idempotent via zoho_links + zoho_last_modified comparison.
 */
export async function processZohoWebhook(payload: WebhookPayload) {
  const event = String(
    payload.event ?? payload.event_type ?? "",
  ).toLowerCase();

  let handled = "ignored";

  if (event.includes("invoice") || payload.invoice || payload.invoice_id) {
    await handleInvoiceEvent(payload);
    handled = "invoice";
  }

  if (
    event.includes("payment") ||
    payload.payment ||
    payload.customerpayment ||
    payload.payment_id
  ) {
    await handlePaymentEvent(payload);
    handled = handled === "invoice" ? "invoice+payment" : "payment";
  }

  await prisma.zohoSyncLog.create({
    data: {
      direction: ZohoSyncDirection.zoho_to_crm,
      action: `webhook.${handled}`,
      status: ZohoSyncStatus.success,
      requestPayload: redactSecrets(payload) as Prisma.InputJsonValue,
      attempts: 1,
    },
  });

  return { handled };
}

async function handleInvoiceEvent(payload: WebhookPayload) {
  const inv = payload.invoice ?? {};
  const zohoId = String(
    inv.invoice_id ?? payload.invoice_id ?? "",
  );
  if (!zohoId) return;

  const link = await prisma.zohoLink.findUnique({
    where: {
      entityType_zohoId: { entityType: ZohoEntityType.invoice, zohoId },
    },
  });
  if (!link) return; // unknown invoice — CRM owns creation; ignore

  const modified = parseDate(inv.last_modified_time);
  if (
    link.zohoLastModified &&
    modified &&
    modified <= link.zohoLastModified
  ) {
    return;
  }

  // Prefer full fetch for accurate balance when webhook body is thin
  let balance = Number(inv.balance ?? NaN);
  let total = Number(inv.total ?? NaN);
  let invoiceNumber =
    typeof inv.invoice_number === "string" ? inv.invoice_number : undefined;

  if (!Number.isFinite(balance) || !Number.isFinite(total)) {
    try {
      const full = await getInvoice(zohoId);
      balance = Number(full.invoice.balance ?? 0);
      total = Number(full.invoice.total ?? 0);
      if (typeof full.invoice.invoice_number === "string") {
        invoiceNumber = full.invoice.invoice_number;
      }
    } catch {
      return;
    }
  }

  const amountPaid = Math.max(0, total - balance);
  let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
  if (balance <= 0.01) paymentStatus = PaymentStatus.PAID;
  else if (amountPaid > 0) paymentStatus = PaymentStatus.PARTIAL;

  await prisma.invoice.updateMany({
    where: { id: link.crmId, deletedAt: null },
    data: {
      amountPaid,
      paymentStatus,
      ...(invoiceNumber ? { invoiceNumber } : {}),
    },
  });

  await upsertZohoLink({
    entityType: ZohoEntityType.invoice,
    crmId: link.crmId,
    zohoId,
    zohoLastModified: modified ?? new Date(),
  });
}

async function handlePaymentEvent(payload: WebhookPayload) {
  const pay = payload.payment ?? payload.customerpayment ?? {};
  const zohoId = String(pay.payment_id ?? payload.payment_id ?? "");
  if (!zohoId) return;

  const existing = await prisma.zohoLink.findUnique({
    where: {
      entityType_zohoId: { entityType: ZohoEntityType.payment, zohoId },
    },
  });

  const modified = parseDate(pay.last_modified_time);

  // If we already linked this payment, only refresh timestamp (CRM owns payment create)
  if (existing) {
    if (
      existing.zohoLastModified &&
      modified &&
      modified <= existing.zohoLastModified
    ) {
      return;
    }
    await upsertZohoLink({
      entityType: ZohoEntityType.payment,
      crmId: existing.crmId,
      zohoId,
      zohoLastModified: modified ?? new Date(),
    });
    return;
  }

  // Payment created in Zoho for a linked invoice — refresh invoice balances
  const invoices = (pay.invoices as Array<Record<string, unknown>>) ?? [];
  for (const row of invoices) {
    const invZohoId = String(row.invoice_id ?? "");
    if (!invZohoId) continue;
    await handleInvoiceEvent({
      event: "invoice_updated",
      invoice_id: invZohoId,
    });
  }
}
