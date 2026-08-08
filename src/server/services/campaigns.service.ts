import { type Prisma, CampaignStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import type {
  CampaignFilters,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateCampaignMetricsInput,
} from "@/lib/validators/campaign";

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
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { subject: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listCampaigns(
  pagination: PaginationInput,
  filters: CampaignFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
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

export async function getCampaignById(id: string) {
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
) {
  void _userId;
  const existing = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Campaign not found");

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

export async function deleteCampaign(id: string) {
  const existing = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Campaign not found");

  return prisma.campaign.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function updateCampaignMetrics(
  id: string,
  input: UpdateCampaignMetricsInput,
) {
  const existing = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
    include: { metrics: true },
  });
  if (!existing) throw notFound("Campaign not found");

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
