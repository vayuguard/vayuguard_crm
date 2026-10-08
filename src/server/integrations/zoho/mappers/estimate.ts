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
import { ZOHO_LINE, ZOHO_TXN } from "@/server/integrations/zoho/fields";

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
    [ZOHO_TXN.customerId]: zohoCustomerId,
    [ZOHO_TXN.estimateNumber]: quotation.quoteNumber,
    [ZOHO_TXN.date]: fmtDate(quotation.createdAt),
    [ZOHO_TXN.expiryDate]: quotation.validUntil
      ? fmtDate(quotation.validUntil)
      : undefined,
    [ZOHO_TXN.notes]: quotation.notes ?? undefined,
    [ZOHO_TXN.gstTreatment]: resolveGstTreatment(quotation.customer),
    [ZOHO_TXN.placeOfSupply]: resolvePlaceOfSupply(quotation.customer),
    [ZOHO_TXN.isInclusiveTax]: false,
    [ZOHO_TXN.lineItems]: quotation.items.map((item) => ({
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
