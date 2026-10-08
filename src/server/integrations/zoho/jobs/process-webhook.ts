import {
  ZohoEntityType,
  ZohoSyncDirection,
  ZohoSyncStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { getInvoice } from "@/server/integrations/zoho/client";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import { upsertZohoLink } from "@/server/integrations/zoho/queue";
import { mapZohoInvoiceToCrm } from "@/server/integrations/zoho/mappers/invoice";
import { applyZohoContactToCrm } from "@/server/integrations/zoho/jobs/apply-contact";
import {
  ZOHO_CONTACT,
  ZOHO_PAYMENT,
  ZOHO_TXN,
} from "@/server/integrations/zoho/fields";

type WebhookPayload = {
  event?: string;
  event_type?: string;
  invoice?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  customerpayment?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  invoice_id?: string;
  payment_id?: string;
  contact_id?: string;
  [key: string]: unknown;
};

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Apply Zoho → CRM webhook payload (contact / invoice / payment events).
 * Idempotent via zoho_links + zoho_last_modified comparison.
 */
export async function processZohoWebhook(payload: WebhookPayload) {
  const event = String(
    payload.event ?? payload.event_type ?? "",
  ).toLowerCase();

  const handled: string[] = [];

  if (event.includes("contact") || payload.contact || payload.contact_id) {
    await handleContactEvent(payload);
    handled.push("contact");
  }

  if (event.includes("invoice") || payload.invoice || payload.invoice_id) {
    await handleInvoiceEvent(payload);
    handled.push("invoice");
  }

  if (
    event.includes("payment") ||
    payload.payment ||
    payload.customerpayment ||
    payload.payment_id
  ) {
    await handlePaymentEvent(payload);
    handled.push("payment");
  }

  await prisma.zohoSyncLog.create({
    data: {
      direction: ZohoSyncDirection.zoho_to_crm,
      action: `webhook.${handled.length ? handled.join("+") : "ignored"}`,
      status: ZohoSyncStatus.success,
      requestPayload: redactSecrets(payload) as Prisma.InputJsonValue,
      attempts: 1,
    },
  });

  return { handled: handled.length ? handled.join("+") : "ignored" };
}

async function handleContactEvent(payload: WebhookPayload) {
  const contact = payload.contact ?? {};
  const zohoId = String(
    contact[ZOHO_CONTACT.contactId] ?? payload.contact_id ?? "",
  );
  if (!zohoId) return;

  const link = await prisma.zohoLink.findUnique({
    where: {
      entityType_zohoId: { entityType: ZohoEntityType.customer, zohoId },
    },
  });
  if (!link) return;

  const modified = parseDate(contact[ZOHO_CONTACT.lastModifiedTime]);
  if (
    link.zohoLastModified &&
    modified &&
    modified <= link.zohoLastModified
  ) {
    return;
  }

  await applyZohoContactToCrm(zohoId, link.crmId, contact);
  await upsertZohoLink({
    entityType: ZohoEntityType.customer,
    crmId: link.crmId,
    zohoId,
    zohoLastModified: modified ?? new Date(),
  });
}

async function handleInvoiceEvent(payload: WebhookPayload) {
  const inv = payload.invoice ?? {};
  const zohoId = String(
    inv[ZOHO_TXN.invoiceId] ?? payload.invoice_id ?? "",
  );
  if (!zohoId) return;

  const link = await prisma.zohoLink.findUnique({
    where: {
      entityType_zohoId: { entityType: ZohoEntityType.invoice, zohoId },
    },
  });
  if (!link) return; // unknown invoice — CRM owns creation; ignore

  const modified = parseDate(inv[ZOHO_TXN.lastModifiedTime]);
  if (
    link.zohoLastModified &&
    modified &&
    modified <= link.zohoLastModified
  ) {
    return;
  }

  let zohoInv = inv;
  const balance = Number(inv[ZOHO_TXN.balance] ?? NaN);
  const total = Number(inv[ZOHO_TXN.total] ?? NaN);
  if (!Number.isFinite(balance) || !Number.isFinite(total)) {
    try {
      const full = await getInvoice(zohoId);
      zohoInv = full.invoice;
    } catch {
      return;
    }
  }

  const mapped = mapZohoInvoiceToCrm(zohoInv);
  await prisma.invoice.updateMany({
    where: { id: link.crmId, deletedAt: null },
    data: {
      amountPaid: mapped.amountPaid,
      paymentStatus: mapped.paymentStatus,
      ...(mapped.invoiceNumber ? { invoiceNumber: mapped.invoiceNumber } : {}),
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
  const zohoId = String(
    pay[ZOHO_PAYMENT.paymentId] ?? payload.payment_id ?? "",
  );
  if (!zohoId) return;

  const existing = await prisma.zohoLink.findUnique({
    where: {
      entityType_zohoId: { entityType: ZohoEntityType.payment, zohoId },
    },
  });

  const modified = parseDate(pay[ZOHO_PAYMENT.lastModifiedTime]);

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
  const invoices = (pay[ZOHO_PAYMENT.invoices] as Array<Record<string, unknown>>) ?? [];
  for (const row of invoices) {
    const invZohoId = String(row[ZOHO_PAYMENT.invoiceId] ?? "");
    if (!invZohoId) continue;
    await handleInvoiceEvent({
      event: "invoice_updated",
      invoice_id: invZohoId,
    });
  }
}
