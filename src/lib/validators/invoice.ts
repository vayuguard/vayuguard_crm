import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "./common";

export const invoiceStatusSchema = z.nativeEnum(InvoiceStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);

export const invoiceItemSchema = z.object({
  productId: optionalCuid,
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.coerce.number().finite().min(0),
  taxPercent: z.coerce.number().finite().min(0).max(100).optional().default(18),
  discount: z.coerce.number().finite().min(0).optional().default(0),
});

export const createInvoiceSchema = z.object({
  customerId: cuidSchema,
  quotationId: optionalCuid,
  status: invoiceStatusSchema.optional().default(InvoiceStatus.DRAFT),
  issueDate: optionalDate,
  dueDate: z.coerce.date(),
  discountAmount: z.coerce.number().finite().min(0).optional().default(0),
  notes: emptyToNull,
  items: z.array(invoiceItemSchema).min(1),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  items: z.array(invoiceItemSchema).min(1).optional(),
  customerId: cuidSchema.optional(),
  dueDate: z.coerce.date().optional(),
});

export const invoiceFiltersSchema = z.object({
  status: invoiceStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  customerId: cuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createPaymentSchema = z.object({
  amount: z.coerce.number().finite().positive(),
  method: emptyToNull,
  reference: emptyToNull,
  paidAt: optionalDate,
  notes: emptyToNull,
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
