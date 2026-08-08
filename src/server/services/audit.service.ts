import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { PaginationInput } from "@/server/api/pagination";
import { cuidSchema } from "@/lib/validators/common";

type AuditInput = {
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export const auditFiltersSchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: cuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function listAuditLogs(
  pagination: PaginationInput,
  filters: AuditFilters = {},
) {
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  if (pagination.q?.trim()) {
    const term = pagination.q.trim();
    where.OR = [
      { action: { contains: term, mode: "insensitive" } },
      { entityType: { contains: term, mode: "insensitive" } },
      { entityId: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);

  return { items, total };
}
