import { type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "@/lib/validators/common";

export const createDealSchema = z.object({
  title: z.string().trim().min(1).max(200),
  pipelineId: cuidSchema,
  stageId: cuidSchema,
  leadId: optionalCuid,
  customerId: optionalCuid,
  assignedToId: optionalCuid,
  expectedRevenue: z.coerce.number().finite().min(0),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: optionalDate,
  notes: emptyToNull,
  position: z.coerce.number().int().optional(),
});

export const updateDealSchema = createDealSchema.partial();

export const moveDealSchema = z.object({
  stageId: cuidSchema,
  position: z.coerce.number().int().optional(),
  note: emptyToNull,
});

export const dealFiltersSchema = z.object({
  pipelineId: z.string().cuid().optional(),
  stageId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type MoveDealInput = z.infer<typeof moveDealSchema>;
export type DealFilters = z.infer<typeof dealFiltersSchema>;

const dealInclude = {
  pipeline: { select: { id: true, name: true } },
  stage: true,
  lead: { select: { id: true, name: true, leadNumber: true } },
  customer: { select: { id: true, name: true, customerNumber: true } },
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
} satisfies Prisma.DealInclude;

function buildWhere(
  filters: DealFilters,
  q?: string,
): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = { deletedAt: null };
  if (filters.pipelineId) where.pipelineId = filters.pipelineId;
  if (filters.stageId) where.stageId = filters.stageId;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { notes: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDeals(
  pagination: PaginationInput,
  filters: DealFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
      where,
      include: dealInclude,
      orderBy: [{ stageId: "asc" }, { position: "asc" }, { updatedAt: "desc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getDealById(id: string) {
  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...dealInclude,
      stageHistory: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      quotations: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!deal) throw notFound("Deal not found");
  return deal;
}

async function assertStageInPipeline(pipelineId: string, stageId: string) {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipelineId },
  });
  if (!stage) {
    throw validationError("Stage does not belong to the selected pipeline");
  }
  return stage;
}

export async function createDeal(input: CreateDealInput, userId: string) {
  const stage = await assertStageInPipeline(input.pipelineId, input.stageId);

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        title: input.title,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        leadId: input.leadId,
        customerId: input.customerId,
        assignedToId: input.assignedToId,
        expectedRevenue: input.expectedRevenue,
        probability: input.probability ?? stage.probability,
        expectedCloseDate: input.expectedCloseDate,
        notes: input.notes,
        position: input.position ?? 0,
        createdById: userId,
        updatedById: userId,
        closedAt: stage.isWon || stage.isLost ? new Date() : null,
      },
      include: dealInclude,
    });

    await tx.dealStageHistory.create({
      data: {
        dealId: deal.id,
        fromStageId: null,
        toStageId: input.stageId,
        changedById: userId,
        note: "Deal created",
      },
    });

    return deal;
  });
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput,
  userId: string,
) {
  const existing = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Deal not found");

  const pipelineId = input.pipelineId ?? existing.pipelineId;
  const stageId = input.stageId ?? existing.stageId;
  const stage = await assertStageInPipeline(pipelineId, stageId);

  return prisma.$transaction(async (tx) => {
    if (input.stageId && input.stageId !== existing.stageId) {
      await tx.dealStageHistory.create({
        data: {
          dealId: id,
          fromStageId: existing.stageId,
          toStageId: input.stageId,
          changedById: userId,
          note: "Stage changed via update",
        },
      });
    }

    return tx.deal.update({
      where: { id },
      data: {
        ...input,
        expectedRevenue:
          input.expectedRevenue === undefined
            ? undefined
            : input.expectedRevenue,
        probability:
          input.probability ??
          (input.stageId ? stage.probability : undefined),
        closedAt:
          stage.isWon || stage.isLost
            ? existing.closedAt ?? new Date()
            : null,
        updatedById: userId,
      },
      include: dealInclude,
    });
  });
}

export async function moveDeal(
  id: string,
  input: MoveDealInput,
  userId: string,
) {
  const existing = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Deal not found");

  const stage = await assertStageInPipeline(existing.pipelineId, input.stageId);

  return prisma.$transaction(async (tx) => {
    if (input.stageId !== existing.stageId) {
      await tx.dealStageHistory.create({
        data: {
          dealId: id,
          fromStageId: existing.stageId,
          toStageId: input.stageId,
          changedById: userId,
          note: input.note ?? undefined,
        },
      });
    }

    return tx.deal.update({
      where: { id },
      data: {
        stageId: input.stageId,
        position: input.position ?? existing.position,
        probability: stage.probability,
        closedAt:
          stage.isWon || stage.isLost
            ? existing.closedAt ?? new Date()
            : null,
        updatedById: userId,
      },
      include: dealInclude,
    });
  });
}

export async function deleteDeal(id: string, userId: string) {
  const existing = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Deal not found");

  return prisma.deal.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}
