import type { Customer, Invoice, InvoiceItem, Product } from "@prisma/client";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  resolveGstTreatment,
  resolvePlaceOfSupply,
  taxIdForPercent,
} from "@/server/integrations/zoho/mappers/gst";

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
    customer_id: zohoCustomerId,
    invoice_number: invoice.invoiceNumber,
    date: fmtDate(invoice.issueDate),
    due_date: fmtDate(invoice.dueDate),
    notes: invoice.notes ?? undefined,
    gst_treatment: gstTreatment,
    place_of_supply: placeOfSupply,
    is_inclusive_tax: false,
    line_items: invoice.items.map((item) => ({
      name: item.product?.name ?? item.description,
      description: item.description,
      rate: Number(item.unitPrice),
      quantity: Number(item.quantity),
      discount: Number(item.discount),
      tax_percentage: taxIdForPercent(Number(item.taxPercent)),
      hsn_or_sac: item.product?.hsnSac ?? undefined,
      item_custom_fields: [],
    })),
  };
}
