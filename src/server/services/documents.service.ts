import { DocumentCategory, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
} from "@/lib/validators/common";

export const createDocumentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.nativeEnum(DocumentCategory).optional().default(DocumentCategory.OTHER),
  fileUrl: z.string().url(),
  fileType: emptyToNull,
  fileSize: z.coerce.number().int().min(0).optional().nullable(),
  leadId: optionalCuid,
  customerId: optionalCuid,
  ticketId: optionalCuid,
});

export const updateDocumentSchema = createDocumentSchema.partial();

export const documentFiltersSchema = z.object({
  category: z.nativeEnum(DocumentCategory).optional(),
  leadId: cuidSchema.optional(),
  customerId: cuidSchema.optional(),
  ticketId: cuidSchema.optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentFilters = z.infer<typeof documentFiltersSchema>;

const documentInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, name: true, leadNumber: true } },
  customer: { select: { id: true, name: true, customerNumber: true } },
  ticket: { select: { id: true, ticketNumber: true, subject: true } },
  versions: { orderBy: { version: "desc" as const }, take: 10 },
} satisfies Prisma.DocumentInclude;

function buildWhere(
  filters: DocumentFilters,
  q?: string,
): Prisma.DocumentWhereInput {
  const where: Prisma.DocumentWhereInput = { deletedAt: null };
  if (filters.category) where.category = filters.category;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.ticketId) where.ticketId = filters.ticketId;
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { fileType: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDocuments(
  pagination: PaginationInput,
  filters: DocumentFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      include: documentInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getDocumentById(id: string) {
  const document = await prisma.document.findFirst({
    where: { id, deletedAt: null },
    include: documentInclude,
  });
  if (!document) throw notFound("Document not found");
  return document;
}

export async function createDocument(
  input: CreateDocumentInput,
  userId: string,
) {
  return prisma.document.create({
    data: {
      name: input.name,
      category: input.category ?? DocumentCategory.OTHER,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSize: input.fileSize ?? undefined,
      leadId: input.leadId,
      customerId: input.customerId,
      ticketId: input.ticketId,
      uploadedById: userId,
      versions: {
        create: {
          version: 1,
          fileUrl: input.fileUrl,
          fileSize: input.fileSize ?? undefined,
          createdById: userId,
        },
      },
    },
    include: documentInclude,
  });
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  userId: string,
) {
  const existing = await prisma.document.findFirst({
    where: { id, deletedAt: null },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!existing) throw notFound("Document not found");

  return prisma.$transaction(async (tx) => {
    if (input.fileUrl && input.fileUrl !== existing.fileUrl) {
      const nextVersion = (existing.versions[0]?.version ?? 1) + 1;
      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: nextVersion,
          fileUrl: input.fileUrl,
          fileSize: input.fileSize ?? existing.fileSize ?? undefined,
          createdById: userId,
        },
      });
    }

    return tx.document.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        fileUrl: input.fileUrl,
        fileType: input.fileType === undefined ? undefined : input.fileType,
        fileSize: input.fileSize === undefined ? undefined : input.fileSize,
        leadId: input.leadId === undefined ? undefined : input.leadId,
        customerId: input.customerId === undefined ? undefined : input.customerId,
        ticketId: input.ticketId === undefined ? undefined : input.ticketId,
      },
      include: documentInclude,
    });
  });
}

export async function deleteDocument(id: string) {
  const existing = await prisma.document.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Document not found");

  return prisma.document.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
