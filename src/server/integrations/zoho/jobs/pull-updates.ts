import { PaymentStatus, ZohoEntityType, ZohoSyncDirection, ZohoSyncStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import {
  listCustomerPaymentsModifiedSince,
  listInvoicesModifiedSince,
} from "@/server/integrations/zoho/client";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import {
  getSyncState,
  setSyncState,
  upsertZohoLink,
} from "@/server/integrations/zoho/queue";

function parseZohoDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function pullZohoUpdates() {
  if (!(await isZohoSyncEnabled())) return { skipped: true as const };

  const results = {
    invoices: 0,
    payments: 0,
  };

  const invoiceCursor =
    (await getSyncState("invoices_last_modified")) ??
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);

  let page = 1;
  let latestInvoiceMod = invoiceCursor;
  for (;;) {
    const res = await listInvoicesModifiedSince(invoiceCursor, page);
    for (const inv of res.invoices ?? []) {
      const zohoId = String(inv.invoice_id ?? "");
      if (!zohoId) continue;
      const modified = parseZohoDate(inv.last_modified_time);
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

      const balance = Number(inv.balance ?? 0);
      const total = Number(inv.total ?? 0);
      const amountPaid = Math.max(0, total - balance);
      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
      if (balance <= 0.01) paymentStatus = PaymentStatus.PAID;
      else if (amountPaid > 0) paymentStatus = PaymentStatus.PARTIAL;

      await prisma.invoice.updateMany({
        where: { id: link.crmId, deletedAt: null },
        data: {
          amountPaid,
          paymentStatus,
          invoiceNumber:
            typeof inv.invoice_number === "string"
              ? inv.invoice_number
              : undefined,
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

  const paymentCursor =
    (await getSyncState("payments_last_modified")) ??
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);
  page = 1;
  let latestPayMod = paymentCursor;
  for (;;) {
    const res = await listCustomerPaymentsModifiedSince(paymentCursor, page);
    for (const pay of res.customerpayments ?? []) {
      const zohoId = String(pay.payment_id ?? "");
      if (!zohoId) continue;
      const modified = parseZohoDate(pay.last_modified_time);
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
