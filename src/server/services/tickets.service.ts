import { type Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import type {
  CreateTicketInput,
  CreateTicketMessageInput,
  TicketFilters,
  UpdateTicketInput,
} from "@/lib/validators/ticket";

const ticketInclude = {
  customer: { select: { id: true, name: true, customerNumber: true } },
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  _count: { select: { messages: true, attachments: true } },
} satisfies Prisma.SupportTicketInclude;

async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const prefix = `TK-${year}-`;
  const latest = await prisma.supportTicket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  const current = latest
    ? Number(latest.ticketNumber.slice(prefix.length))
    : 0;
  return `${prefix}${String(current + 1).padStart(4, "0")}`;
}

function buildWhere(
  filters: TicketFilters,
  q?: string,
): Prisma.SupportTicketWhereInput {
  const where: Prisma.SupportTicketWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { ticketNumber: { contains: term, mode: "insensitive" } },
      { subject: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listTickets(
  pagination: PaginationInput,
  filters: TicketFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getTicketById(id: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...ticketInclude,
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!ticket) throw notFound("Ticket not found");
  return ticket;
}

export async function createTicket(input: CreateTicketInput, userId: string) {
  const ticketNumber = await nextTicketNumber();
  return prisma.supportTicket.create({
    data: {
      ticketNumber,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      department: input.department,
      status: input.status ?? TicketStatus.OPEN,
      slaDueAt: input.slaDueAt,
      customerId: input.customerId,
      assignedToId: input.assignedToId,
      internalNotes: input.internalNotes,
      createdById: userId,
      updatedById: userId,
    },
    include: ticketInclude,
  });
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  userId: string,
) {
  const existing = await prisma.supportTicket.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Ticket not found");

  const resolved =
    input.status === TicketStatus.RESOLVED ||
    input.status === TicketStatus.CLOSED;

  return prisma.supportTicket.update({
    where: { id },
    data: {
      ...input,
      resolvedAt: resolved
        ? existing.resolvedAt ?? new Date()
        : input.status
          ? null
          : undefined,
      updatedById: userId,
    },
    include: ticketInclude,
  });
}

export async function deleteTicket(id: string, userId: string) {
  const existing = await prisma.supportTicket.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Ticket not found");

  return prisma.supportTicket.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}

export async function listTicketMessages(
  ticketId: string,
  pagination: PaginationInput,
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
    select: { id: true },
  });
  if (!ticket) throw notFound("Ticket not found");

  const where = { ticketId };
  const [total, items] = await Promise.all([
    prisma.ticketMessage.count({ where }),
    prisma.ticketMessage.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function createTicketMessage(
  ticketId: string,
  input: CreateTicketMessageInput,
  userId: string,
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
  });
  if (!ticket) throw notFound("Ticket not found");

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketMessage.create({
      data: {
        ticketId,
        body: input.body,
        isInternal: input.isInternal ?? false,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    if (ticket.status === TicketStatus.OPEN) {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.IN_PROGRESS, updatedById: userId },
      });
    } else {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { updatedById: userId },
      });
    }

    return created;
  });

  return message;
}
