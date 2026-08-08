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

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: emptyToNull,
  industry: emptyToNull,
  website: optionalUrl,
  email: optionalEmail,
  phone: emptyToNull,
  gstNumber: emptyToNull,
  panNumber: emptyToNull,
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
  return prisma.customer.create({
    data: {
      ...input,
      customerNumber,
      billingCountry: input.billingCountry ?? "India",
      createdById: userId,
      updatedById: userId,
    },
    include: customerInclude,
  });
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

  return prisma.customer.update({
    where: { id },
    data: { ...input, updatedById: userId },
    include: customerInclude,
  });
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
