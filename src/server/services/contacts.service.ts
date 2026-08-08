import { type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
  optionalEmail,
  optionalUrl,
} from "@/lib/validators/common";

export const createContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  designation: emptyToNull,
  email: optionalEmail,
  phone: emptyToNull,
  whatsapp: emptyToNull,
  birthday: optionalDate,
  department: emptyToNull,
  customerId: optionalCuid,
  linkedinUrl: optionalUrl,
  twitterUrl: optionalUrl,
  facebookUrl: optionalUrl,
  notes: emptyToNull,
  relationshipScore: z.coerce.number().int().min(0).max(100).optional(),
  tagIds: z.array(cuidSchema).optional().default([]),
  /** Tag names — upserted and linked when tagIds not provided */
  tags: z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      return v
        .split(/[,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, z.array(z.string().trim().min(1).max(80))).optional().default([]),
});

export const updateContactSchema = createContactSchema.partial().extend({
  tagIds: z.array(cuidSchema).optional(),
  tags: z
    .preprocess((v) => {
      if (v === undefined) return undefined;
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        return v
          .split(/[,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    }, z.array(z.string().trim().min(1).max(80)).optional())
    .optional(),
});

export const contactFiltersSchema = z.object({
  customerId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactFilters = z.infer<typeof contactFiltersSchema>;

const contactInclude = {
  customer: {
    select: { id: true, name: true, customerNumber: true },
  },
  tags: { include: { tag: true } },
} satisfies Prisma.ContactInclude;

function buildWhere(
  filters: ContactFilters,
  q?: string,
): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { deletedAt: null };
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { designation: { contains: term, mode: "insensitive" } },
      { department: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listContacts(
  pagination: PaginationInput,
  filters: ContactFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: contactInclude,
      orderBy: {
        [pagination.sort && ["name", "createdAt", "relationshipScore"].includes(pagination.sort)
          ? pagination.sort
          : "createdAt"]: pagination.order,
      },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getContactById(id: string) {
  const contact = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
    include: contactInclude,
  });
  if (!contact) throw notFound("Contact not found");
  return contact;
}

async function resolveTagIds(
  tagIds?: string[],
  tagNames?: string[],
): Promise<string[]> {
  if (tagIds && tagIds.length > 0) return tagIds;
  if (!tagNames || tagNames.length === 0) return tagIds ?? [];
  const ids: string[] = [];
  for (const raw of tagNames) {
    const name = raw.trim();
    if (!name) continue;
    const existing = await prisma.tag.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      ids.push(existing.id);
    } else {
      const created = await prisma.tag.create({ data: { name } });
      ids.push(created.id);
    }
  }
  return ids;
}

export async function createContact(
  input: CreateContactInput,
  userId: string,
) {
  const { tagIds = [], tags = [], ...data } = input;
  const resolvedTagIds = await resolveTagIds(tagIds, tags);
  return prisma.contact.create({
    data: {
      ...data,
      createdById: userId,
      updatedById: userId,
      tags:
        resolvedTagIds.length > 0
          ? { create: resolvedTagIds.map((tagId) => ({ tagId })) }
          : undefined,
    },
    include: contactInclude,
  });
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
  userId: string,
) {
  const existing = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Contact not found");

  const { tagIds, tags, ...data } = input;
  const shouldUpdateTags = tagIds !== undefined || tags !== undefined;
  const resolvedTagIds = shouldUpdateTags
    ? await resolveTagIds(tagIds, tags)
    : undefined;

  return prisma.$transaction(async (tx) => {
    if (resolvedTagIds) {
      await tx.contactTag.deleteMany({ where: { contactId: id } });
      if (resolvedTagIds.length > 0) {
        await tx.contactTag.createMany({
          data: resolvedTagIds.map((tagId) => ({ contactId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    return tx.contact.update({
      where: { id },
      data: { ...data, updatedById: userId },
      include: contactInclude,
    });
  });
}

export async function deleteContact(id: string, userId: string) {
  const existing = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Contact not found");

  return prisma.contact.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}
