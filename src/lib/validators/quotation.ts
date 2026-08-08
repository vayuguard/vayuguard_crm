import { QuotationStatus } from "@prisma/client";
import { z } from "zod";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "./common";

export const quotationStatusSchema = z.nativeEnum(QuotationStatus);

export const quotationItemSchema = z.object({
  productId: optionalCuid,
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.coerce.number().finite().min(0),
  taxPercent: z.coerce.number().finite().min(0).max(100).optional().default(18),
  discount: z.coerce.number().finite().min(0).optional().default(0),
});

export const createQuotationSchema = z.object({
  customerId: optionalCuid,
  dealId: optionalCuid,
  status: quotationStatusSchema.optional().default(QuotationStatus.DRAFT),
  terms: emptyToNull,
  notes: emptyToNull,
  validUntil: optionalDate,
  discountAmount: z.coerce.number().finite().min(0).optional().default(0),
  items: z.array(quotationItemSchema).min(1),
});

export const updateQuotationSchema = createQuotationSchema
  .partial()
  .extend({
    items: z.array(quotationItemSchema).min(1).optional(),
  });

export const quotationFiltersSchema = z.object({
  status: quotationStatusSchema.optional(),
  customerId: cuidSchema.optional(),
  dealId: cuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const emailQuotationSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(200).optional(),
  message: emptyToNull,
  cc: z.string().email().optional().nullable(),
});

export type QuotationItemInput = z.infer<typeof quotationItemSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type QuotationFilters = z.infer<typeof quotationFiltersSchema>;
export type EmailQuotationInput = z.infer<typeof emailQuotationSchema>;
