import type {
  Customer,
  Product,
  Quotation,
  QuotationItem,
} from "@prisma/client";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  resolveGstTreatment,
  resolvePlaceOfSupply,
  taxIdForPercent,
} from "@/server/integrations/zoho/mappers/gst";

type QuotationWithRelations = Quotation & {
  customer: Customer | null;
  items: Array<QuotationItem & { product?: Product | null }>;
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function mapQuotationToZohoEstimate(
  quotation: QuotationWithRelations,
  zohoCustomerId: string,
) {
  if (!quotation.customer) {
    throw new ZohoValidationError("Quotation has no customer");
  }
  if (!quotation.items.length) {
    throw new ZohoValidationError("Quotation has no line items");
  }

  return {
    customer_id: zohoCustomerId,
    estimate_number: quotation.quoteNumber,
    date: fmtDate(quotation.createdAt),
    expiry_date: quotation.validUntil
      ? fmtDate(quotation.validUntil)
      : undefined,
    notes: quotation.notes ?? undefined,
    gst_treatment: resolveGstTreatment(quotation.customer),
    place_of_supply: resolvePlaceOfSupply(quotation.customer),
    is_inclusive_tax: false,
    line_items: quotation.items.map((item) => ({
      name: item.product?.name ?? item.description,
      description: item.description,
      rate: Number(item.unitPrice),
      quantity: Number(item.quantity),
      discount: Number(item.discount),
      tax_percentage: taxIdForPercent(Number(item.taxPercent)),
      hsn_or_sac: item.product?.hsnSac ?? undefined,
    })),
  };
}
