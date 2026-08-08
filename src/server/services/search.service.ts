import { z } from "zod";
import { prisma } from "@/server/db/client";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
  modules: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    ),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

const ALL_MODULES = [
  "leads",
  "customers",
  "contacts",
  "deals",
  "tasks",
  "products",
  "quotations",
  "invoices",
  "tickets",
  "campaigns",
  "documents",
  "employees",
] as const;

export async function globalSearch(input: SearchQuery) {
  const term = input.q.trim();
  const limit = input.limit ?? 8;
  const modules = new Set(
    (input.modules?.length ? input.modules : [...ALL_MODULES]).map((m) =>
      m.toLowerCase(),
    ),
  );

  const results: {
    module: string;
    id: string;
    title: string;
    subtitle?: string | null;
    href: string;
  }[] = [];

  const tasks: Promise<void>[] = [];

  if (modules.has("leads")) {
    tasks.push(
      prisma.lead
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { company: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { leadNumber: { contains: term, mode: "insensitive" } },
              { phone: { contains: term, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            leadNumber: true,
            company: true,
            status: true,
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "leads",
              id: row.id,
              title: `${row.leadNumber} · ${row.name}`,
              subtitle: row.company ?? row.status,
              href: `/leads/${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("customers")) {
    tasks.push(
      prisma.customer
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { customerNumber: { contains: term, mode: "insensitive" } },
              { phone: { contains: term, mode: "insensitive" } },
              { gstNumber: { contains: term, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            customerNumber: true,
            email: true,
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "customers",
              id: row.id,
              title: `${row.customerNumber} · ${row.name}`,
              subtitle: row.email,
              href: `/customers?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("contacts")) {
    tasks.push(
      prisma.contact
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { phone: { contains: term, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, email: true, designation: true },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "contacts",
              id: row.id,
              title: row.name,
              subtitle: row.email ?? row.designation,
              href: `/contacts?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("deals")) {
    tasks.push(
      prisma.deal
        .findMany({
          where: {
            deletedAt: null,
            title: { contains: term, mode: "insensitive" },
          },
          select: {
            id: true,
            title: true,
            expectedRevenue: true,
            stage: { select: { name: true } },
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "deals",
              id: row.id,
              title: row.title,
              subtitle: `${row.stage.name} · ${Number(row.expectedRevenue)}`,
              href: `/pipeline?dealId=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("tasks")) {
    tasks.push(
      prisma.task
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            dueAt: true,
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "tasks",
              id: row.id,
              title: row.title,
              subtitle: `${row.type} · ${row.status}`,
              href: `/tasks?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("products")) {
    tasks.push(
      prisma.product
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { sku: { contains: term, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, sku: true, price: true },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "products",
              id: row.id,
              title: `${row.sku} · ${row.name}`,
              subtitle: String(Number(row.price)),
              href: `/products?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("quotations")) {
    tasks.push(
      prisma.quotation
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { quoteNumber: { contains: term, mode: "insensitive" } },
              { notes: { contains: term, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            total: true,
            customer: { select: { name: true } },
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "quotations",
              id: row.id,
              title: row.quoteNumber,
              subtitle: `${row.customer?.name ?? "—"} · ${row.status}`,
              href: `/quotations?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("invoices")) {
    tasks.push(
      prisma.invoice
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { invoiceNumber: { contains: term, mode: "insensitive" } },
              { notes: { contains: term, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            invoiceNumber: true,
            paymentStatus: true,
            total: true,
            customer: { select: { name: true } },
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "invoices",
              id: row.id,
              title: row.invoiceNumber,
              subtitle: `${row.customer.name} · ${row.paymentStatus}`,
              href: `/invoices?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("tickets")) {
    tasks.push(
      prisma.supportTicket
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { ticketNumber: { contains: term, mode: "insensitive" } },
              { subject: { contains: term, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "tickets",
              id: row.id,
              title: `${row.ticketNumber} · ${row.subject}`,
              subtitle: row.status,
              href: `/support?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("campaigns")) {
    tasks.push(
      prisma.campaign
        .findMany({
          where: {
            deletedAt: null,
            name: { contains: term, mode: "insensitive" },
          },
          select: { id: true, name: true, channel: true, status: true },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "campaigns",
              id: row.id,
              title: row.name,
              subtitle: `${row.channel} · ${row.status}`,
              href: `/marketing?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("documents")) {
    tasks.push(
      prisma.document
        .findMany({
          where: {
            deletedAt: null,
            name: { contains: term, mode: "insensitive" },
          },
          select: { id: true, name: true, category: true },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "documents",
              id: row.id,
              title: row.name,
              subtitle: row.category,
              href: `/documents?id=${row.id}`,
            });
          }
        }),
    );
  }

  if (modules.has("employees")) {
    tasks.push(
      prisma.user
        .findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              {
                employeeProfile: {
                  employeeCode: { contains: term, mode: "insensitive" },
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            employeeProfile: { select: { department: true } },
          },
          take: limit,
        })
        .then((rows) => {
          for (const row of rows) {
            results.push({
              module: "employees",
              id: row.id,
              title: row.name ?? row.email,
              subtitle: row.employeeProfile?.department ?? row.email,
              href: `/employees?id=${row.id}`,
            });
          }
        }),
    );
  }

  await Promise.all(tasks);
  return { q: term, results };
}
