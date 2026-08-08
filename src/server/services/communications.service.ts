import { CommunicationType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import type { PaginationInput } from "@/server/api/pagination";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
} from "@/lib/validators/common";

export const createCommunicationSchema = z.object({
  type: z.nativeEnum(CommunicationType),
  subject: emptyToNull,
  body: emptyToNull,
  direction: z.enum(["inbound", "outbound"]).optional().default("outbound"),
  leadId: optionalCuid,
  customerId: optionalCuid,
  attachments: z.array(z.string().url()).optional().default([]),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const communicationFiltersSchema = z.object({
  type: z.nativeEnum(CommunicationType).optional(),
  leadId: cuidSchema.optional(),
  customerId: cuidSchema.optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateCommunicationInput = z.infer<typeof createCommunicationSchema>;
export type CommunicationFilters = z.infer<typeof communicationFiltersSchema>;

const communicationInclude = {
  author: { select: { id: true, name: true, email: true, image: true } },
  lead: { select: { id: true, name: true, leadNumber: true } },
  customer: { select: { id: true, name: true, customerNumber: true } },
} satisfies Prisma.CommunicationInclude;

function buildWhere(
  filters: CommunicationFilters,
  q?: string,
): Prisma.CommunicationWhereInput {
  const where: Prisma.CommunicationWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.direction) where.direction = filters.direction;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { subject: { contains: term, mode: "insensitive" } },
      { body: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listCommunications(
  pagination: PaginationInput,
  filters: CommunicationFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.communication.count({ where }),
    prisma.communication.findMany({
      where,
      include: communicationInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function createCommunication(
  input: CreateCommunicationInput,
  userId: string,
) {
  const communication = await prisma.communication.create({
    data: {
      type: input.type,
      subject: input.subject,
      body: input.body,
      direction: input.direction ?? "outbound",
      leadId: input.leadId,
      customerId: input.customerId,
      authorId: userId,
      attachments: input.attachments ?? [],
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    include: communicationInclude,
  });

  const { processMentions } = await import("@/server/services/mentions.service");
  const mentionSource = [input.subject, input.body].filter(Boolean).join("\n");
  await processMentions({
    text: mentionSource,
    authorId: userId,
    entityType: "Communication",
    entityId: communication.id,
    link: input.leadId
      ? `/leads/${input.leadId}`
      : input.customerId
        ? `/customers?id=${input.customerId}`
        : "/communications",
  });

  return communication;
}
