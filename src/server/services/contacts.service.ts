import { LeadStatus, Priority, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
  optionalEmail,
  optionalUrl,
} from "@/lib/validators/common";
import { pickColumn } from "@/server/lib/excel";
import { createLead, nextCustomerNumber } from "@/server/services/leads.service";

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

/**
 * Stable Excel headers — same columns for export and import.
 * Zoho Books contact_persons map as:
 *   name ← first_name + last_name
 *   email ← email
 *   phone ← phone
 *   whatsapp ← mobile
 *   designation ← designation
 *   department ← department
 * customerNumber/customerEmail link to CRM Customer (Zoho company Contact).
 * interest / social / notes / tags are CRM-only (not from Zoho).
 *
 * interest values: not_interested | cold | warm | interested | hot
 * (stored as relationshipScore 0 / 25 / 50 / 75 / 100)
 */
export const CONTACT_EXCEL_HEADERS = [
  // Zoho contact_persons ↔ CRM Contact
  "name",
  "email",
  "phone",
  "whatsapp",
  "designation",
  "department",
  // Link to CRM Customer (Zoho company Contact)
  "customerNumber",
  "customerEmail",
  // CRM-only
  "interest",
  "linkedinUrl",
  "twitterUrl",
  "facebookUrl",
  "notes",
  "tags",
] as const;

export type ContactExcelRow = Record<
  (typeof CONTACT_EXCEL_HEADERS)[number],
  string
>;

const INTEREST_SCORES = {
  not_interested: 0,
  cold: 25,
  warm: 50,
  interested: 75,
  hot: 100,
} as const;

type InterestLabel = keyof typeof INTEREST_SCORES;

function interestFromScore(score: number | null | undefined): InterestLabel {
  const s = score ?? 50;
  if (s <= 12) return "not_interested";
  if (s <= 37) return "cold";
  if (s <= 62) return "warm";
  if (s <= 87) return "interested";
  return "hot";
}

function parseInterest(value: string): InterestLabel | null {
  const v = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v) return null;
  if (v in INTEREST_SCORES) return v as InterestLabel;
  // Friendly aliases
  if (v === "notinterested" || v === "no") return "not_interested";
  if (v === "yes") return "interested";
  return null;
}

export async function exportContacts(
  filters: ContactFilters = {},
  q?: string,
): Promise<ContactExcelRow[]> {
  const where = buildWhere(filters, q);
  const contacts = await prisma.contact.findMany({
    where,
    include: {
      customer: { select: { customerNumber: true, email: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  return contacts.map((c) => ({
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    whatsapp: c.whatsapp ?? "",
    designation: c.designation ?? "",
    department: c.department ?? "",
    customerNumber: c.customer?.customerNumber ?? "",
    customerEmail: c.customer?.email ?? "",
    interest: interestFromScore(c.relationshipScore),
    linkedinUrl: c.linkedinUrl ?? "",
    twitterUrl: c.twitterUrl ?? "",
    facebookUrl: c.facebookUrl ?? "",
    notes: c.notes ?? "",
    tags: c.tags.map((t) => t.tag.name).join(", "),
  }));
}

async function resolveCustomerIdFromImport(row: Record<string, string>) {
  const customerNumber = pickColumn(row, "customerNumber");
  const customerEmail = pickColumn(row, "customerEmail");
  if (customerNumber) {
    const byNumber = await prisma.customer.findFirst({
      where: { customerNumber, deletedAt: null },
      select: { id: true },
    });
    if (byNumber) return byNumber.id;
  }
  if (customerEmail) {
    const byEmail = await prisma.customer.findFirst({
      where: { email: customerEmail, deletedAt: null },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }
  return null;
}

export async function importContactsFromRows(
  rows: Array<Record<string, string>>,
  userId: string,
) {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as { row: number; message: string }[],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const name = pickColumn(row, "name");
    if (!name && !pickColumn(row, "email", "phone")) {
      results.skipped += 1;
      continue;
    }
    if (!name) {
      results.skipped += 1;
      results.errors.push({ row: i + 2, message: "name is required" });
      continue;
    }

    try {
      const email = pickColumn(row, "email") || null;
      const customerId = await resolveCustomerIdFromImport(row);
      const tags = pickColumn(row, "tags")
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const interestRaw = pickColumn(row, "interest");
      const interest = parseInterest(interestRaw);
      if (interestRaw && !interest) {
        results.skipped += 1;
        results.errors.push({
          row: i + 2,
          message:
            "interest must be not_interested, cold, warm, interested, or hot",
        });
        continue;
      }

      const data = {
        name,
        designation: pickColumn(row, "designation") || null,
        email,
        phone: pickColumn(row, "phone") || null,
        whatsapp: pickColumn(row, "whatsapp") || null,
        department: pickColumn(row, "department") || null,
        customerId,
        relationshipScore: interest ? INTEREST_SCORES[interest] : undefined,
        linkedinUrl: pickColumn(row, "linkedinUrl") || null,
        twitterUrl: pickColumn(row, "twitterUrl") || null,
        facebookUrl: pickColumn(row, "facebookUrl") || null,
        notes: pickColumn(row, "notes") || null,
        tags,
        tagIds: [] as string[],
      };

      const existing = email
        ? await prisma.contact.findFirst({
            where: { email, deletedAt: null },
            select: { id: true },
          })
        : null;

      if (existing) {
        await updateContact(existing.id, data, userId);
        results.updated += 1;
      } else {
        await createContact(data, userId);
        results.created += 1;
      }
    } catch (error) {
      results.skipped += 1;
      results.errors.push({
        row: i + 2,
        message: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  return results;
}

function companyFromContactNotes(notes: string | null | undefined) {
  if (!notes) return null;
  const match = notes.match(/^\s*Company:\s*(.+)$/im);
  return match?.[1]?.trim() || null;
}

/** Create a Lead from a Contact person (Contact stays; no hard link). */
export async function convertContactToLead(contactId: string, userId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, deletedAt: null },
    include: {
      customer: {
        select: { id: true, name: true, industry: true, website: true },
      },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
  if (!contact) throw notFound("Contact not found");

  const company =
    contact.customer?.name ||
    companyFromContactNotes(contact.notes) ||
    null;

  const lead = await createLead(
    {
      name: contact.name,
      company,
      industry: contact.customer?.industry ?? null,
      email: contact.email,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      website: contact.customer?.website ?? null,
      address: null,
      city: null,
      state: null,
      country: "India",
      pinCode: null,
      source: "Contact",
      campaignId: null,
      status: LeadStatus.NEW,
      priority: Priority.MEDIUM,
      estimatedDealValue: null,
      expectedClosingDate: null,
      assignedToId: null,
      notes: [
        `Created from contact ${contact.name}`,
        contact.designation ? `Designation: ${contact.designation}` : null,
        contact.department ? `Department: ${contact.department}` : null,
        contact.notes,
      ]
        .filter(Boolean)
        .join("\n"),
      tagIds: [],
      tags: contact.tags.map((t) => t.tag.name).join(", ") || null,
    },
    userId,
  );

  return { lead, contact };
}

/** Create a Customer from a Contact and link the contact to it. */
export async function convertContactToCustomer(
  contactId: string,
  userId: string,
  options: { companyName?: string | null } = {},
) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, deletedAt: null },
  });
  if (!contact) throw notFound("Contact not found");
  if (contact.customerId) {
    throw validationError("Contact is already linked to a customer", {
      customerId: contact.customerId,
    });
  }

  const companyName =
    options.companyName?.trim() ||
    companyFromContactNotes(contact.notes) ||
    contact.name;

  const customerNumber = await nextCustomerNumber();

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        customerNumber,
        name: companyName,
        legalName: companyName,
        email: contact.email,
        phone: contact.phone,
        notes: `Created from contact ${contact.name}`,
        createdById: userId,
        updatedById: userId,
      },
    });

    const updatedContact = await tx.contact.update({
      where: { id: contactId },
      data: {
        customerId: customer.id,
        updatedById: userId,
      },
      include: contactInclude,
    });

    return { customer, contact: updatedContact };
  });

  return result;
}
