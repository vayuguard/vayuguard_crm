import { type Prisma, CampaignStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  applyMineScope,
  assertMine,
  type TeamRecordScope,
} from "@/server/auth/team-scope";
import type {
  CampaignFilters,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateCampaignMetricsInput,
} from "@/lib/validators/campaign";

const CAMPAIGN_OWNER_KEYS = ["createdById"] as const;

const campaignInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  metrics: true,
  _count: { select: { leads: true, recipients: true } },
} satisfies Prisma.CampaignInclude;

function computeRoi(spent: number, revenue: number) {
  if (spent <= 0) return revenue > 0 ? null : 0;
  return ((revenue - spent) / spent) * 100;
}

function withRoi<
  T extends { spent: unknown; metrics?: { revenue: unknown } | null },
>(campaign: T) {
  const spent = Number(campaign.spent);
  const revenue = Number(campaign.metrics?.revenue ?? 0);
  return {
    ...campaign,
    roiPercent: computeRoi(spent, revenue),
    revenue,
  };
}

function buildWhere(
  filters: CampaignFilters,
  q?: string,
  scope?: TeamRecordScope,
): Prisma.CampaignWhereInput {
  const where: Prisma.CampaignWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.channel) where.channel = filters.channel;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { subject: { contains: term, mode: "insensitive" } },
        ],
      },
    ];
  }
  return applyMineScope(where, scope, [...CAMPAIGN_OWNER_KEYS]);
}

export async function listCampaigns(
  pagination: PaginationInput,
  filters: CampaignFilters = {},
  scope?: TeamRecordScope,
) {
  const where = buildWhere(filters, pagination.q, scope);
  const [total, items] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      include: campaignInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items: items.map(withRoi), total };
}

export async function getCampaignById(id: string, scope?: TeamRecordScope) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...campaignInclude,
      recipients: { orderBy: { id: "desc" }, take: 100 },
      leads: {
        where: { deletedAt: null },
        select: { id: true, leadNumber: true, name: true, status: true },
        take: 50,
      },
    },
  });
  if (!campaign) throw notFound("Campaign not found");
  assertMine(
    campaign,
    scope,
    [...CAMPAIGN_OWNER_KEYS],
    "You can only access your own campaigns",
  );
  return withRoi(campaign);
}

export async function createCampaign(
  input: CreateCampaignInput,
  userId: string,
) {
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      channel: input.channel,
      status: input.status ?? CampaignStatus.DRAFT,
      subject: input.subject,
      content: input.content,
      budget: input.budget ?? undefined,
      spent: input.spent ?? 0,
      scheduledAt: input.scheduledAt,
      createdById: userId,
      metrics: { create: {} },
    },
    include: campaignInclude,
  });
  return withRoi(campaign);
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
  _userId: string,
  scope?: TeamRecordScope,
) {
  void _userId;
  const existing = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Campaign not found");
  assertMine(
    existing,
    scope,
    [...CAMPAIGN_OWNER_KEYS],
    "You can only access your own campaigns",
  );

  const data: Prisma.CampaignUpdateInput = {
    name: input.name,
    channel: input.channel,
    status: input.status,
    subject: input.subject === undefined ? undefined : input.subject,
    content: input.content === undefined ? undefined : input.content,
    budget: input.budget === undefined ? undefined : input.budget,
    spent: input.spent,
    scheduledAt: input.scheduledAt === undefined ? undefined : input.scheduledAt,
  };

  if (input.status === CampaignStatus.RUNNING && !existing.startedAt) {
    data.startedAt = new Date();
  }
  if (
    (input.status === CampaignStatus.COMPLETED ||
      input.status === CampaignStatus.CANCELLED) &&
    !existing.completedAt
  ) {
    data.completedAt = new Date();
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data,
    include: campaignInclude,
  });
  return withRoi(campaign);
}

export async function deleteCampaign(id: string, scope?: TeamRecordScope) {
  const existing = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Campaign not found");
  assertMine(
    existing,
    scope,
    [...CAMPAIGN_OWNER_KEYS],
    "You can only access your own campaigns",
  );

  return prisma.campaign.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function updateCampaignMetrics(
  id: string,
  input: UpdateCampaignMetricsInput,
  scope?: TeamRecordScope,
) {
  const existing = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
    include: { metrics: true },
  });
  if (!existing) throw notFound("Campaign not found");
  assertMine(
    existing,
    scope,
    [...CAMPAIGN_OWNER_KEYS],
    "You can only access your own campaigns",
  );

  const metrics = await prisma.campaignMetric.upsert({
    where: { campaignId: id },
    create: {
      campaignId: id,
      sentCount: input.sentCount ?? 0,
      openCount: input.openCount ?? 0,
      clickCount: input.clickCount ?? 0,
      replyCount: input.replyCount ?? 0,
      leadCount: input.leadCount ?? 0,
      revenue: input.revenue ?? 0,
    },
    update: {
      ...input,
      revenue: input.revenue === undefined ? undefined : input.revenue,
    },
  });

  return withRoi({ ...existing, metrics });
}
