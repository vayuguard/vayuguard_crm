import { type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  emptyToNull,
  optionalCuid,
  optionalEmail,
  optionalUrl,
} from "@/lib/validators/common";
import { nextCustomerNumber } from "@/server/services/leads.service";
import { pickColumn } from "@/server/lib/excel";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: emptyToNull,
  industry: emptyToNull,
  website: optionalUrl,
  email: optionalEmail,
  phone: emptyToNull,
  gstNumber: emptyToNull,
  panNumber: emptyToNull,
  gstTreatment: emptyToNull,
  placeOfSupply: emptyToNull,
  billingAddress: emptyToNull,
  billingCity: emptyToNull,
  billingState: emptyToNull,
  billingCountry: emptyToNull.default("India"),
  billingPinCode: emptyToNull,
  shippingAddress: emptyToNull,
  shippingCity: emptyToNull,
  shippingState: emptyToNull,
  shippingCountry: emptyToNull,
  shippingPinCode: emptyToNull,
  notes: emptyToNull,
  assignedToId: optionalCuid,
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerFiltersSchema = z.object({
  assignedToId: z.string().cuid().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilters = z.infer<typeof customerFiltersSchema>;

const customerInclude = {
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: {
    select: {
      contacts: true,
      deals: true,
      invoices: true,
      tickets: true,
      projects: true,
    },
  },
} satisfies Prisma.CustomerInclude;

function buildWhere(
  filters: CustomerFilters,
  q?: string,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { deletedAt: null };
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.industry) {
    where.industry = { contains: filters.industry, mode: "insensitive" };
  }
  if (filters.city) {
    where.billingCity = { contains: filters.city, mode: "insensitive" };
  }
  if (filters.state) {
    where.billingState = { contains: filters.state, mode: "insensitive" };
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { legalName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { customerNumber: { contains: term, mode: "insensitive" } },
      { gstNumber: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listCustomers(
  pagination: PaginationInput,
  filters: CustomerFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: {
        [pagination.sort && ["name", "createdAt", "updatedAt"].includes(pagination.sort)
          ? pagination.sort
          : "createdAt"]: pagination.order,
      },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...customerInclude,
      contacts: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      deals: {
        where: { deletedAt: null },
        include: { stage: true, pipeline: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      },
      quotations: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      invoices: {
        where: { deletedAt: null },
        include: {
          payments: { orderBy: { paidAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      payments: {
        orderBy: { paidAt: "desc" },
        take: 50,
      },
      tickets: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      communications: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      meetings: {
        where: { deletedAt: null },
        orderBy: { startsAt: "desc" },
        take: 30,
      },
    },
  });
  if (!customer) throw notFound("Customer not found");
  return customer;
}

export async function createCustomer(
  input: CreateCustomerInput,
  userId: string,
) {
  const customerNumber = await nextCustomerNumber();
  const customer = await prisma.customer.create({
    data: {
      ...input,
      customerNumber,
      billingCountry: input.billingCountry ?? "India",
      createdById: userId,
      updatedById: userId,
    },
    include: customerInclude,
  });
  return customer;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
  userId: string,
) {
  const existing = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Customer not found");

  const customer = await prisma.customer.update({
    where: { id },
    data: { ...input, updatedById: userId },
    include: customerInclude,
  });
  return customer;
}

export async function deleteCustomer(id: string, userId: string) {
  const existing = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Customer not found");

  return prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}

/** Stable Excel headers — export and import use the exact same columns. */
export const CUSTOMER_EXCEL_HEADERS = [
  "customerNumber",
  "name",
  "legalName",
  "industry",
  "website",
  "email",
  "phone",
  "gstNumber",
  "panNumber",
  "gstTreatment",
  "placeOfSupply",
  "billingAddress",
  "billingCity",
  "billingState",
  "billingCountry",
  "billingPinCode",
  "shippingAddress",
  "shippingCity",
  "shippingState",
  "shippingCountry",
  "shippingPinCode",
  "notes",
] as const;

export type CustomerExcelRow = Record<
  (typeof CUSTOMER_EXCEL_HEADERS)[number],
  string
>;

export async function exportCustomers(
  filters: CustomerFilters = {},
  q?: string,
): Promise<CustomerExcelRow[]> {
  const where = buildWhere(filters, q);
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  return customers.map((c) => ({
    customerNumber: c.customerNumber,
    name: c.name,
    legalName: c.legalName ?? "",
    industry: c.industry ?? "",
    website: c.website ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    gstNumber: c.gstNumber ?? "",
    panNumber: c.panNumber ?? "",
    gstTreatment: c.gstTreatment ?? "",
    placeOfSupply: c.placeOfSupply ?? "",
    billingAddress: c.billingAddress ?? "",
    billingCity: c.billingCity ?? "",
    billingState: c.billingState ?? "",
    billingCountry: c.billingCountry ?? "",
    billingPinCode: c.billingPinCode ?? "",
    shippingAddress: c.shippingAddress ?? "",
    shippingCity: c.shippingCity ?? "",
    shippingState: c.shippingState ?? "",
    shippingCountry: c.shippingCountry ?? "",
    shippingPinCode: c.shippingPinCode ?? "",
    notes: c.notes ?? "",
  }));
}

function nullIfEmpty(value: string | undefined | null) {
  const v = value?.trim();
  return v ? v : null;
}

export async function importCustomersFromRows(
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
    // Skip blank template rows
    if (!name && !pickColumn(row, "customerNumber", "email", "gstNumber")) {
      results.skipped += 1;
      continue;
    }
    if (!name) {
      results.skipped += 1;
      results.errors.push({ row: i + 2, message: "name is required" });
      continue;
    }

    try {
      const customerNumber = pickColumn(row, "customerNumber");
      const email = nullIfEmpty(pickColumn(row, "email"));
      const gstNumber = nullIfEmpty(pickColumn(row, "gstNumber"));

      const data = {
        name,
        legalName: nullIfEmpty(pickColumn(row, "legalName")),
        industry: nullIfEmpty(pickColumn(row, "industry")),
        website: nullIfEmpty(pickColumn(row, "website")),
        email,
        phone: nullIfEmpty(pickColumn(row, "phone")),
        gstNumber,
        panNumber: nullIfEmpty(pickColumn(row, "panNumber")),
        gstTreatment: nullIfEmpty(pickColumn(row, "gstTreatment")),
        placeOfSupply: nullIfEmpty(pickColumn(row, "placeOfSupply")),
        billingAddress: nullIfEmpty(pickColumn(row, "billingAddress")),
        billingCity: nullIfEmpty(pickColumn(row, "billingCity")),
        billingState: nullIfEmpty(pickColumn(row, "billingState")),
        billingCountry:
          nullIfEmpty(pickColumn(row, "billingCountry")) ?? "India",
        billingPinCode: nullIfEmpty(pickColumn(row, "billingPinCode")),
        shippingAddress: nullIfEmpty(pickColumn(row, "shippingAddress")),
        shippingCity: nullIfEmpty(pickColumn(row, "shippingCity")),
        shippingState: nullIfEmpty(pickColumn(row, "shippingState")),
        shippingCountry: nullIfEmpty(pickColumn(row, "shippingCountry")),
        shippingPinCode: nullIfEmpty(pickColumn(row, "shippingPinCode")),
        notes: nullIfEmpty(pickColumn(row, "notes")),
      };

      let existing = customerNumber
        ? await prisma.customer.findFirst({
            where: { customerNumber, deletedAt: null },
            select: { id: true },
          })
        : null;

      if (!existing && email) {
        existing = await prisma.customer.findFirst({
          where: { email, deletedAt: null },
          select: { id: true },
        });
      }
      if (!existing && gstNumber) {
        existing = await prisma.customer.findFirst({
          where: { gstNumber, deletedAt: null },
          select: { id: true },
        });
      }

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: { ...data, updatedById: userId },
        });
        results.updated += 1;
      } else {
        await createCustomer(data, userId);
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
