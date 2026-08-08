import { LeadStatus, Priority } from "@prisma/client";
import { z } from "zod";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
  optionalDecimal,
  optionalEmail,
  optionalUrl,
} from "./common";

export const leadStatusSchema = z.nativeEnum(LeadStatus);
export const prioritySchema = z.nativeEnum(Priority);

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: emptyToNull,
  industry: emptyToNull,
  email: optionalEmail,
  phone: emptyToNull,
  whatsapp: emptyToNull,
  website: optionalUrl,
  address: emptyToNull,
  city: emptyToNull,
  state: emptyToNull,
  country: emptyToNull.default("India"),
  pinCode: emptyToNull,
  source: emptyToNull,
  campaignId: optionalCuid,
  status: leadStatusSchema.optional().default(LeadStatus.NEW),
  priority: prioritySchema.optional().default(Priority.MEDIUM),
  estimatedDealValue: optionalDecimal,
  expectedClosingDate: optionalDate,
  notes: emptyToNull,
  assignedToId: optionalCuid,
  tagIds: z.array(cuidSchema).optional().default([]),
  /** Comma-separated tag names; resolved server-side to Tag records */
  tags: z.string().optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  tagIds: z.array(cuidSchema).optional(),
  tags: z.string().optional().nullable(),
});

export const createLeadAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().url(),
  fileType: emptyToNull,
  fileSize: z.coerce.number().int().min(0).optional().nullable(),
});

export const leadFiltersSchema = z.object({
  status: leadStatusSchema.optional(),
  priority: prioritySchema.optional(),
  source: z.string().optional(),
  assignedToId: cuidSchema.optional(),
  campaignId: cuidSchema.optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  tagId: cuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const mergeLeadsSchema = z.object({
  primaryId: cuidSchema,
  mergeIds: z.array(cuidSchema).min(1).max(50),
});

export const bulkUpdateLeadsSchema = z.object({
  ids: z.array(cuidSchema).min(1).max(500),
  data: z
    .object({
      status: leadStatusSchema.optional(),
      priority: prioritySchema.optional(),
      assignedToId: optionalCuid,
      source: emptyToNull,
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "At least one field to update is required",
    }),
});

export const createLeadActivitySchema = z.object({
  type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  description: emptyToNull,
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const convertLeadSchema = z
  .object({
    createContact: z.boolean().optional().default(true),
    notes: emptyToNull,
  })
  .optional()
  .default({ createContact: true });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
export type MergeLeadsInput = z.infer<typeof mergeLeadsSchema>;
export type BulkUpdateLeadsInput = z.infer<typeof bulkUpdateLeadsSchema>;
export type CreateLeadActivityInput = z.infer<typeof createLeadActivitySchema>;
export type CreateLeadAttachmentInput = z.infer<
  typeof createLeadAttachmentSchema
>;
