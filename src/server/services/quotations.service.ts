import { type Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import { emailProvider } from "@/server/providers/email";
import type {
  CreateQuotationInput,
  EmailQuotationInput,
  QuotationFilters,
  QuotationItemInput,
  UpdateQuotationInput,
} from "@/lib/validators/quotation";
import { queueQuotationSync } from "@/server/integrations/zoho/triggers";

const quotationInclude = {
  customer: { select: { id: true, name: true, customerNumber: true, email: true } },
  deal: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  items: {
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  },
  _count: { select: { invoices: true, versions: true } },
} satisfies Prisma.QuotationInclude;

export function calcLineTotals(item: QuotationItemInput) {
  const qty = Number(item.quantity);
  const unit = Number(item.unitPrice);
  const discount = Number(item.discount ?? 0);
  const taxPercent = Number(item.taxPercent ?? 18);
  const taxable = Math.max(0, qty * unit - discount);
  const tax = (taxable * taxPercent) / 100;
  return {
    taxable,
    tax,
    total: taxable + tax,
  };
}

export function calcDocumentTotals(
  items: QuotationItemInput[],
  discountAmount = 0,
) {
  let subtotal = 0;
  let taxAmount = 0;
  const lines = items.map((item) => {
    const line = calcLineTotals(item);
    subtotal += line.taxable;
    taxAmount += line.tax;
    return { ...item, ...line };
  });
  const headerDiscount = Number(discountAmount ?? 0);
  const total = Math.max(0, subtotal + taxAmount - headerDiscount);
  return { lines, subtotal, taxAmount, discountAmount: headerDiscount, total };
}

async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const latest = await prisma.quotation.findFirst({
    where: { quoteNumber: { startsWith: prefix } },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });
  const current = latest
    ? Number(latest.quoteNumber.slice(prefix.length))
    : 0;
  return `${prefix}${String(current + 1).padStart(4, "0")}`;
}

function buildWhere(
  filters: QuotationFilters,
  q?: string,
): Prisma.QuotationWhereInput {
  const where: Prisma.QuotationWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.dealId) where.dealId = filters.dealId;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { quoteNumber: { contains: term, mode: "insensitive" } },
      { notes: { contains: term, mode: "insensitive" } },
      { customer: { name: { contains: term, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listQuotations(
  pagination: PaginationInput,
  filters: QuotationFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      include: quotationInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getQuotationById(id: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...quotationInclude,
      versions: { orderBy: { version: "desc" }, take: 20 },
    },
  });
  if (!quotation) throw notFound("Quotation not found");
  return quotation;
}

export async function createQuotation(
  input: CreateQuotationInput,
  userId: string,
) {
  const totals = calcDocumentTotals(input.items, input.discountAmount ?? 0);
  const quoteNumber = await nextQuoteNumber();

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber,
      customerId: input.customerId,
      dealId: input.dealId,
      status: input.status ?? QuotationStatus.DRAFT,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      total: totals.total,
      terms: input.terms,
      notes: input.notes,
      validUntil: input.validUntil,
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
      versions: {
        create: {
          version: 1,
          snapshot: {
            items: totals.lines,
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            discountAmount: totals.discountAmount,
            total: totals.total,
          },
          createdById: userId,
        },
      },
    },
    include: quotationInclude,
  });
  void queueQuotationSync(quotation.id).catch(() => undefined);
  return quotation;
}

export async function updateQuotation(
  id: string,
  input: UpdateQuotationInput,
  userId: string,
) {
  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    include: { items: true },
  });
  if (!existing) throw notFound("Quotation not found");
  if (existing.status === QuotationStatus.APPROVED) {
    throw validationError("Approved quotations cannot be edited");
  }

  const items = input.items;
  const totals = items
    ? calcDocumentTotals(items, input.discountAmount ?? Number(existing.discountAmount))
    : null;

  return prisma.$transaction(async (tx) => {
    if (items && totals) {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotationItem.createMany({
        data: totals.lines.map((line) => ({
          quotationId: id,
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

    const nextVersion = existing.version + (items ? 1 : 0);
    const updated = await tx.quotation.update({
      where: { id },
      data: {
        customerId: input.customerId === undefined ? undefined : input.customerId,
        dealId: input.dealId === undefined ? undefined : input.dealId,
        status: input.status,
        terms: input.terms === undefined ? undefined : input.terms,
        notes: input.notes === undefined ? undefined : input.notes,
        validUntil: input.validUntil === undefined ? undefined : input.validUntil,
        discountAmount: totals
          ? totals.discountAmount
          : input.discountAmount === undefined
            ? undefined
            : input.discountAmount,
        subtotal: totals?.subtotal,
        taxAmount: totals?.taxAmount,
        total: totals?.total,
        version: items ? nextVersion : undefined,
        updatedById: userId,
      },
      include: quotationInclude,
    });

    if (items && totals) {
      await tx.quotationVersion.create({
        data: {
          quotationId: id,
          version: nextVersion,
          snapshot: {
            items: totals.lines,
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            discountAmount: totals.discountAmount,
            total: totals.total,
          },
          createdById: userId,
        },
      });
    }

    void queueQuotationSync(id).catch(() => undefined);
    return updated;
  });
}

export async function deleteQuotation(id: string, userId: string) {
  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Quotation not found");

  return prisma.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}

export async function approveQuotation(id: string, userId: string) {
  const existing = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Quotation not found");
  if (existing.status === QuotationStatus.APPROVED) {
    throw validationError("Quotation is already approved");
  }
  if (existing.status === QuotationStatus.REJECTED) {
    throw validationError("Rejected quotations cannot be approved");
  }

  return prisma.quotation.update({
    where: { id },
    data: {
      status: QuotationStatus.APPROVED,
      approvedById: userId,
      approvedAt: new Date(),
      updatedById: userId,
    },
    include: quotationInclude,
  });
}

export async function getQuotationPdfPayload(id: string) {
  const quotation = await getQuotationById(id);
  return {
    type: "quotation" as const,
    quoteNumber: quotation.quoteNumber,
    status: quotation.status,
    customer: quotation.customer,
    validUntil: quotation.validUntil,
    terms: quotation.terms,
    notes: quotation.notes,
    items: quotation.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxPercent: Number(item.taxPercent),
      discount: Number(item.discount),
      total: Number(item.total),
      productSku: item.product?.sku ?? null,
    })),
    subtotal: Number(quotation.subtotal),
    taxAmount: Number(quotation.taxAmount),
    discountAmount: Number(quotation.discountAmount),
    total: Number(quotation.total),
    createdAt: quotation.createdAt,
    textStub: [
      `Quotation ${quotation.quoteNumber}`,
      `Customer: ${quotation.customer?.name ?? "—"}`,
      `Status: ${quotation.status}`,
      `Subtotal: ${Number(quotation.subtotal).toFixed(2)}`,
      `GST: ${Number(quotation.taxAmount).toFixed(2)}`,
      `Discount: ${Number(quotation.discountAmount).toFixed(2)}`,
      `Total: ${Number(quotation.total).toFixed(2)}`,
    ].join("\n"),
  };
}

export async function emailQuotation(
  id: string,
  input: EmailQuotationInput,
  userId: string,
) {
  const quotation = await getQuotationById(id);
  const payload = await getQuotationPdfPayload(id);
  const subject =
    input.subject ?? `Quotation ${quotation.quoteNumber} from VayuGuard`;

  const result = await emailProvider.send({
    to: input.to,
    cc: input.cc ?? undefined,
    subject,
    text: input.message
      ? `${input.message}\n\n${payload.textStub}`
      : payload.textStub,
    html: `<pre>${payload.textStub}</pre>`,
    metadata: { quotationId: id, quoteNumber: quotation.quoteNumber, userId },
  });

  if (!result.success) {
    throw validationError(result.error ?? "Failed to send quotation email");
  }

  if (quotation.status === QuotationStatus.DRAFT) {
    await prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.SENT, updatedById: userId },
    });
  }

  return { ...result, quotationId: id };
}
