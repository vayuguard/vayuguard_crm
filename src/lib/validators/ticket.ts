import { Priority, TicketStatus } from "@prisma/client";
import { z } from "zod";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "./common";
import { prioritySchema } from "./lead";

export const ticketStatusSchema = z.nativeEnum(TicketStatus);

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1),
  priority: prioritySchema.optional().default(Priority.MEDIUM),
  department: emptyToNull,
  status: ticketStatusSchema.optional().default(TicketStatus.OPEN),
  slaDueAt: optionalDate,
  customerId: optionalCuid,
  assignedToId: optionalCuid,
  internalNotes: emptyToNull,
});

export const updateTicketSchema = createTicketSchema.partial();

export const ticketFiltersSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: prioritySchema.optional(),
  department: z.string().optional(),
  customerId: cuidSchema.optional(),
  assignedToId: cuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createTicketMessageSchema = z.object({
  body: z.string().trim().min(1),
  isInternal: z.boolean().optional().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type TicketFilters = z.infer<typeof ticketFiltersSchema>;
export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;
