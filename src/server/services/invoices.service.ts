import {
  type Prisma,
  InvoiceStatus,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  calcDocumentTotals,
} from "@/server/services/quotations.service";
import type {
  CreateInvoiceInput,
  CreatePaymentInput,
  InvoiceFilters,
  UpdateInvoiceInput,
} from "@/lib/validators/invoice";
import {
  queueInvoiceSync,
  queuePaymentSync,
} from "@/server/integrations/zoho/triggers";

const invoiceInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      customerNumber: true,
      email: true,
      gstNumber: true,
    },
  },
  quotation: { select: { id: true, quoteNumber: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  items: {
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  },
  payments: { orderBy: { paidAt: "desc" as const } },
} satisfies Prisma.InvoiceInclude;

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const current = latest
    ? Number(latest.invoiceNumber.slice(prefix.length))
    : 0;
  return `${prefix}${String(current + 1).padStart(4, "0")}`;
}

async function nextPaymentNumber() {
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;
  const latest = await prisma.payment.findFirst({
    where: { paymentNumber: { startsWith: prefix } },
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  });
  const current = latest
    ? Number(latest.paymentNumber.slice(prefix.length))
    : 0;
  return `${prefix}${String(current + 1).padStart(4, "0")}`;
}

export function resolvePaymentStatus(
  total: number,
  amountPaid: number,
  dueDate: Date,
  status?: InvoiceStatus,
): { paymentStatus: PaymentStatus; invoiceStatus?: InvoiceStatus } {
  if (status === InvoiceStatus.CANCELLED) {
    return { paymentStatus: PaymentStatus.CANCELLED };
  }

  const paid = Number(amountPaid);
  const tot = Number(total);
  const now = new Date();

  if (paid <= 0) {
    if (dueDate < now) {
      return {
        paymentStatus: PaymentStatus.OVERDUE,
        invoiceStatus: InvoiceStatus.OVERDUE,
      };
    }
    return {
      paymentStatus: PaymentStatus.PENDING,
      invoiceStatus: status === InvoiceStatus.DRAFT ? InvoiceStatus.DRAFT : InvoiceStatus.SENT,
    };
  }

  if (paid + 0.001 >= tot) {
    return {
      paymentStatus: PaymentStatus.PAID,
      invoiceStatus: InvoiceStatus.PAID,
    };
  }

  if (dueDate < now) {
    return {
      paymentStatus: PaymentStatus.OVERDUE,
      invoiceStatus: InvoiceStatus.OVERDUE,
    };
  }

  return {
    paymentStatus: PaymentStatus.PARTIAL,
    invoiceStatus: InvoiceStatus.PARTIALLY_PAID,
  };
}

function buildWhere(
  filters: InvoiceFilters,
  q?: string,
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.from || filters.to) {
    where.issueDate = {};
    if (filters.from) where.issueDate.gte = filters.from;
    if (filters.to) where.issueDate.lte = filters.to;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { invoiceNumber: { contains: term, mode: "insensitive" } },
      { notes: { contains: term, mode: "insensitive" } },
      { customer: { name: { contains: term, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listInvoices(
  pagination: PaginationInput,
  filters: InvoiceFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getInvoiceById(id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: invoiceInclude,
  });
  if (!invoice) throw notFound("Invoice not found");
  return invoice;
}

export async function createInvoice(input: CreateInvoiceInput, userId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, deletedAt: null },
    select: { id: true },
  });
  if (!customer) throw notFound("Customer not found");

  const totals = calcDocumentTotals(input.items, input.discountAmount ?? 0);
  const invoiceNumber = await nextInvoiceNumber();
  const issueDate = input.issueDate ?? new Date();
  const resolved = resolvePaymentStatus(
    totals.total,
    0,
    input.dueDate,
    input.status,
  );

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: input.customerId,
      quotationId: input.quotationId,
      status: resolved.invoiceStatus ?? input.status ?? InvoiceStatus.DRAFT,
      paymentStatus: resolved.paymentStatus,
      issueDate,
      dueDate: input.dueDate,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      total: totals.total,
      amountPaid: 0,
      notes: input.notes,
      createdById: userId,
      updatedById: userId,
      items: {
        create: totals.lines.map((line) => ({
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxPercent: line.taxPercent ?? 18,
          discount: line.discount ?? 0,
          total: line.total,
        })),
      },
    },
    include: invoiceInclude,
  });
  void queueInvoiceSync(invoice.id).catch(() => undefined);
  return invoice;
}

export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput,
  userId: string,
) {
  const existing = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Invoice not found");
  if (existing.status === InvoiceStatus.PAID) {
    throw validationError("Paid invoices cannot be edited");
  }

  const items = input.items;
  const totals = items
    ? calcDocumentTotals(
        items,
        input.discountAmount ?? Number(existing.discountAmount),
      )
    : null;

  const dueDate = input.dueDate ?? existing.dueDate;
  const total = totals?.total ?? Number(existing.total);
  const amountPaid = Number(existing.amountPaid);
  const resolved = resolvePaymentStatus(
    total,
    amountPaid,
    dueDate,
    input.status ?? existing.status,
  );

  return prisma.$transaction(async (tx) => {
    if (items && totals) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.createMany({
        data: totals.lines.map((line) => ({
          invoiceId: id,
          productId: line.productId ?? null,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxPercent: line.taxPercent ?? 18,
          discount: line.discount ?? 0,
          total: line.total,
        })),
      });
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: {
        customerId: input.customerId,
        quotationId:
          input.quotationId === undefined ? undefined : input.quotationId,
        status: resolved.invoiceStatus ?? input.status,
        paymentStatus: resolved.paymentStatus,
        issueDate:
          input.issueDate === undefined
            ? undefined
            : input.issueDate ?? undefined,
        dueDate: input.dueDate,
        notes: input.notes === undefined ? undefined : input.notes,
        discountAmount: totals
          ? totals.discountAmount
          : input.discountAmount === undefined
            ? undefined
            : input.discountAmount,
        subtotal: totals?.subtotal,
        taxAmount: totals?.taxAmount,
        total: totals?.total,
        updatedById: userId,
      },
      include: invoiceInclude,
    });
    void queueInvoiceSync(id).catch(() => undefined);
    return updated;
  });
}

export async function deleteInvoice(id: string, userId: string) {
  const existing = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Invoice not found");

  return prisma.invoice.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}

export async function recordPayment(
  invoiceId: string,
  input: CreatePaymentInput,
  userId: string,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
  });
  if (!invoice) throw notFound("Invoice not found");
  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw validationError("Cannot record payment on a cancelled invoice");
  }

  const amount = Number(input.amount);
  const newPaid = Number(invoice.amountPaid) + amount;
  if (newPaid > Number(invoice.total) + 0.01) {
    throw validationError("Payment exceeds invoice total");
  }

  const paymentNumber = await nextPaymentNumber();
  const resolved = resolvePaymentStatus(
    Number(invoice.total),
    newPaid,
    invoice.dueDate,
    invoice.status,
  );

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        invoiceId,
        customerId: invoice.customerId,
        amount,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt ?? new Date(),
        notes: input.notes,
        createdById: userId,
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newPaid,
        paymentStatus: resolved.paymentStatus,
        status: resolved.invoiceStatus ?? invoice.status,
        updatedById: userId,
      },
      include: invoiceInclude,
    });

    return { payment, invoice: updatedInvoice };
  });
  void queuePaymentSync(result.payment.id).catch(() => undefined);
  return result;
}

export async function getInvoicePdfPayload(id: string) {
  const invoice = await getInvoiceById(id);
  return {
    type: "invoice" as const,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    customer: invoice.customer,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxPercent: Number(item.taxPercent),
      discount: Number(item.discount),
      total: Number(item.total),
      productSku: item.product?.sku ?? null,
    })),
    payments: invoice.payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt,
    })),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balanceDue: Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)),
    textStub: [
      `Invoice ${invoice.invoiceNumber}`,
      `Customer: ${invoice.customer.name}`,
      `Payment: ${invoice.paymentStatus}`,
      `Subtotal: ${Number(invoice.subtotal).toFixed(2)}`,
      `GST: ${Number(invoice.taxAmount).toFixed(2)}`,
      `Total: ${Number(invoice.total).toFixed(2)}`,
      `Paid: ${Number(invoice.amountPaid).toFixed(2)}`,
    ].join("\n"),
  };
}
