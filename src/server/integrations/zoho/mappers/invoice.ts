import type { Customer, Invoice, InvoiceItem, Product } from "@prisma/client";
import { PaymentStatus } from "@prisma/client";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  resolveGstTreatment,
  resolvePlaceOfSupply,
  taxIdForPercent,
} from "@/server/integrations/zoho/mappers/gst";
import {
  ZOHO_LINE,
  ZOHO_TXN,
  num,
  str,
} from "@/server/integrations/zoho/fields";

type InvoiceWithRelations = Invoice & {
  customer: Customer;
  items: Array<InvoiceItem & { product?: Product | null }>;
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function mapInvoiceToZoho(
  invoice: InvoiceWithRelations,
  zohoCustomerId: string,
) {
  if (!invoice.items.length) {
    throw new ZohoValidationError("Invoice has no line items");
  }

  const placeOfSupply = resolvePlaceOfSupply(invoice.customer);
  const gstTreatment = resolveGstTreatment(invoice.customer);

  return {
    [ZOHO_TXN.customerId]: zohoCustomerId,
    [ZOHO_TXN.invoiceNumber]: invoice.invoiceNumber,
    [ZOHO_TXN.date]: fmtDate(invoice.issueDate),
    [ZOHO_TXN.dueDate]: fmtDate(invoice.dueDate),
    [ZOHO_TXN.notes]: invoice.notes ?? undefined,
    [ZOHO_TXN.gstTreatment]: gstTreatment,
    [ZOHO_TXN.placeOfSupply]: placeOfSupply,
    [ZOHO_TXN.isInclusiveTax]: false,
    [ZOHO_TXN.lineItems]: invoice.items.map((item) => ({
      [ZOHO_LINE.name]: item.product?.name ?? item.description,
      [ZOHO_LINE.description]: item.description,
      [ZOHO_LINE.rate]: Number(item.unitPrice),
      [ZOHO_LINE.quantity]: Number(item.quantity),
      [ZOHO_LINE.discount]: Number(item.discount),
      [ZOHO_LINE.taxPercentage]: taxIdForPercent(Number(item.taxPercent)),
      [ZOHO_LINE.hsnOrSac]: item.product?.hsnSac ?? undefined,
    })),
  };
}

/** Zoho Invoice → CRM invoice payment/status fields Zoho is allowed to own. */
export function mapZohoInvoiceToCrm(zoho: Record<string, unknown>) {
  const balance = num(zoho[ZOHO_TXN.balance]) ?? 0;
  const total = num(zoho[ZOHO_TXN.total]) ?? 0;
  const amountPaid = Math.max(0, total - balance);

  let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
  if (balance <= 0.01) paymentStatus = PaymentStatus.PAID;
  else if (amountPaid > 0) paymentStatus = PaymentStatus.PARTIAL;

  return {
    invoiceNumber: str(zoho[ZOHO_TXN.invoiceNumber]) ?? undefined,
    amountPaid,
    paymentStatus,
    total,
    balance,
    issueDate: str(zoho[ZOHO_TXN.date]),
    dueDate: str(zoho[ZOHO_TXN.dueDate]),
    notes: str(zoho[ZOHO_TXN.notes]),
    placeOfSupply: str(zoho[ZOHO_TXN.placeOfSupply]),
    gstTreatment: str(zoho[ZOHO_TXN.gstTreatment]),
  };
}
