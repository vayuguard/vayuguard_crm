import {
  ZohoEntityType,
  ZohoSyncDirection,
  ZohoSyncStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import {
  getCustomerPayment,
  listContactsModifiedSince,
  listCustomerPaymentsModifiedSince,
  listInvoicesModifiedSince,
} from "@/server/integrations/zoho/client";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";
import { getZohoPullMaxPages } from "@/server/integrations/zoho/config";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import {
  getSyncState,
  setSyncState,
  upsertZohoLink,
} from "@/server/integrations/zoho/queue";
import { applyZohoContactToCrm } from "@/server/integrations/zoho/jobs/apply-contact";
import { mapZohoInvoiceToCrm } from "@/server/integrations/zoho/mappers/invoice";
import { mapZohoPaymentToCrm } from "@/server/integrations/zoho/mappers/payment";
import {
  ZOHO_CONTACT,
  ZOHO_PAYMENT,
  ZOHO_TXN,
} from "@/server/integrations/zoho/fields";

function parseZohoDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function pullZohoUpdates() {
  if (!(await isZohoSyncEnabled())) return { skipped: true as const };

  const results = {
    contacts: 0,
    invoices: 0,
    payments: 0,
  };
  const maxPages = getZohoPullMaxPages();

  // ── Contacts (customers) ────────────────────────────────────────────────
  const contactCursor =
    (await getSyncState("contacts_last_modified")) ??
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);
  let page = 1;
  let latestContactMod = contactCursor;
  for (;;) {
    if (page > maxPages) break;
    const res = await listContactsModifiedSince(contactCursor, page);
    for (const contact of res.contacts ?? []) {
      const zohoId = String(contact[ZOHO_CONTACT.contactId] ?? "");
      if (!zohoId) continue;
      const modified = parseZohoDate(contact[ZOHO_CONTACT.lastModifiedTime]);
      const link = await prisma.zohoLink.findUnique({
        where: {
          entityType_zohoId: { entityType: ZohoEntityType.customer, zohoId },
        },
      });
      if (!link) continue;
      if (
        link.zohoLastModified &&
        modified &&
        modified <= link.zohoLastModified
      ) {
        continue;
      }

      await applyZohoContactToCrm(zohoId, link.crmId, contact);
      await upsertZohoLink({
        entityType: ZohoEntityType.customer,
        crmId: link.crmId,
        zohoId,
        zohoLastModified: modified ?? new Date(),
      });
      results.contacts += 1;
      if (modified) {
        const iso = modified.toISOString().slice(0, 19);
        if (iso > latestContactMod) latestContactMod = iso;
      }
    }
    if (!res.page_context?.has_more_page) break;
    page += 1;
  }
  await setSyncState("contacts_last_modified", latestContactMod);

  // ── Invoices ────────────────────────────────────────────────────────────
  const invoiceCursor =
    (await getSyncState("invoices_last_modified")) ??
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);

  page = 1;
  let latestInvoiceMod = invoiceCursor;
  for (;;) {
    if (page > maxPages) break;
    const res = await listInvoicesModifiedSince(invoiceCursor, page);
    for (const inv of res.invoices ?? []) {
      const zohoId = String(inv[ZOHO_TXN.invoiceId] ?? "");
      if (!zohoId) continue;
      const modified = parseZohoDate(inv[ZOHO_TXN.lastModifiedTime]);
      const link = await prisma.zohoLink.findUnique({
        where: {
          entityType_zohoId: { entityType: ZohoEntityType.invoice, zohoId },
        },
      });
      if (!link) continue;

      if (
        link.zohoLastModified &&
        modified &&
        modified <= link.zohoLastModified
      ) {
        continue; // never overwrite with older Zoho data
      }

      const mapped = mapZohoInvoiceToCrm(inv);
      await prisma.invoice.updateMany({
        where: { id: link.crmId, deletedAt: null },
        data: {
          amountPaid: mapped.amountPaid,
          paymentStatus: mapped.paymentStatus,
          ...(mapped.invoiceNumber
            ? { invoiceNumber: mapped.invoiceNumber }
            : {}),
        },
      });

      await upsertZohoLink({
        entityType: ZohoEntityType.invoice,
        crmId: link.crmId,
        zohoId,
        zohoLastModified: modified ?? new Date(),
      });
      results.invoices += 1;
      if (modified) {
        const iso = modified.toISOString().slice(0, 19);
        if (iso > latestInvoiceMod) latestInvoiceMod = iso;
      }
    }
    if (!res.page_context?.has_more_page) break;
    page += 1;
  }
  await setSyncState("invoices_last_modified", latestInvoiceMod);

  // ── Payments ────────────────────────────────────────────────────────────
  const paymentCursor =
    (await getSyncState("payments_last_modified")) ??
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);
  page = 1;
  let latestPayMod = paymentCursor;
  for (;;) {
    if (page > maxPages) break;
    const res = await listCustomerPaymentsModifiedSince(paymentCursor, page);
    for (const pay of res.customerpayments ?? []) {
      const zohoId = String(pay[ZOHO_PAYMENT.paymentId] ?? "");
      if (!zohoId) continue;
      const modified = parseZohoDate(pay[ZOHO_PAYMENT.lastModifiedTime]);
      const link = await prisma.zohoLink.findUnique({
        where: {
          entityType_zohoId: { entityType: ZohoEntityType.payment, zohoId },
        },
      });
      if (!link) continue;
      if (
        link.zohoLastModified &&
        modified &&
        modified <= link.zohoLastModified
      ) {
        continue;
      }

      let zohoPay = pay;
      try {
        const full = await getCustomerPayment(zohoId);
        zohoPay = (full.payment ??
          (full as { customerpayment?: Record<string, unknown> })
            .customerpayment ??
          pay) as Record<string, unknown>;
      } catch {
        // thin list payload
      }

      const mapped = mapZohoPaymentToCrm(zohoPay);
      await prisma.payment.updateMany({
        where: { id: link.crmId },
        data: {
          ...(mapped.amount != null ? { amount: mapped.amount } : {}),
          method: mapped.method,
          reference: mapped.reference,
          notes: mapped.notes,
          ...(mapped.paidAt ? { paidAt: new Date(mapped.paidAt) } : {}),
        },
      });

      await upsertZohoLink({
        entityType: ZohoEntityType.payment,
        crmId: link.crmId,
        zohoId,
        zohoLastModified: modified ?? new Date(),
      });
      results.payments += 1;
      if (modified) {
        const iso = modified.toISOString().slice(0, 19);
        if (iso > latestPayMod) latestPayMod = iso;
      }
    }
    if (!res.page_context?.has_more_page) break;
    page += 1;
  }
  await setSyncState("payments_last_modified", latestPayMod);

  await prisma.zohoSyncLog.create({
    data: {
      direction: ZohoSyncDirection.zoho_to_crm,
      action: "pull_updates",
      status: ZohoSyncStatus.success,
      responsePayload: redactSecrets(results) as Prisma.InputJsonValue,
      attempts: 1,
    },
  });

  return results;
}
