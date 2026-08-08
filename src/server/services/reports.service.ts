import { z } from "zod";
import { prisma } from "@/server/db/client";
import { validationError } from "@/server/api/errors";

export const reportQuerySchema = z.object({
  type: z.enum([
    "sales",
    "revenue",
    "conversion",
    "performance",
    "sources",
    "roi",
    "tickets",
    "invoices",
    "payments",
  ]),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

export async function runReport(query: ReportQuery) {
  const createdAt = dateRange(query.from, query.to);

  switch (query.type) {
    case "sales": {
      const deals = await prisma.deal.findMany({
        where: { deletedAt: null, createdAt },
        select: {
          id: true,
          title: true,
          expectedRevenue: true,
          probability: true,
          closedAt: true,
          stage: { select: { name: true, isWon: true, isLost: true } },
          assignedTo: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      const won = deals.filter((d) => d.stage.isWon);
      const lost = deals.filter((d) => d.stage.isLost);
      const pipelineValue = deals.reduce(
        (sum, d) => sum + Number(d.expectedRevenue) * (d.probability / 100),
        0,
      );
      return {
        type: query.type,
        summary: {
          totalDeals: deals.length,
          wonCount: won.length,
          lostCount: lost.length,
          wonRevenue: won.reduce((s, d) => s + Number(d.expectedRevenue), 0),
          pipelineValue,
        },
        rows: deals.map((d) => ({
          ...d,
          expectedRevenue: Number(d.expectedRevenue),
        })),
      };
    }

    case "revenue": {
      const invoices = await prisma.invoice.findMany({
        where: { deletedAt: null, issueDate: createdAt },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          taxAmount: true,
          paymentStatus: true,
          issueDate: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { issueDate: "desc" },
        take: 5000,
      });
      return {
        type: query.type,
        summary: {
          invoiced: invoices.reduce((s, i) => s + Number(i.total), 0),
          collected: invoices.reduce((s, i) => s + Number(i.amountPaid), 0),
          tax: invoices.reduce((s, i) => s + Number(i.taxAmount), 0),
          count: invoices.length,
        },
        rows: invoices.map((i) => ({
          ...i,
          total: Number(i.total),
          amountPaid: Number(i.amountPaid),
          taxAmount: Number(i.taxAmount),
        })),
      };
    }

    case "conversion": {
      const leads = await prisma.lead.groupBy({
        by: ["status"],
        where: { deletedAt: null, createdAt },
        _count: { _all: true },
      });
      const total = leads.reduce((s, l) => s + l._count._all, 0);
      const won = leads.find((l) => l.status === "WON")?._count._all ?? 0;
      return {
        type: query.type,
        summary: {
          totalLeads: total,
          wonLeads: won,
          conversionRate: total > 0 ? (won / total) * 100 : 0,
        },
        rows: leads.map((l) => ({
          status: l.status,
          count: l._count._all,
          percent: total > 0 ? (l._count._all / total) * 100 : 0,
        })),
      };
    }

    case "performance": {
      const targets = await prisma.salesTarget.findMany({
        where: {
          ...(query.from || query.to
            ? {
                year: {
                  ...(query.from ? { gte: query.from.getFullYear() } : {}),
                  ...(query.to ? { lte: query.to.getFullYear() } : {}),
                },
              }
            : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        take: 2000,
      });
      return {
        type: query.type,
        summary: {
          targetTotal: targets.reduce((s, t) => s + Number(t.targetAmount), 0),
          achievedTotal: targets.reduce(
            (s, t) => s + Number(t.achievedAmount),
            0,
          ),
        },
        rows: targets.map((t) => ({
          userId: t.userId,
          user: t.user,
          period: t.period,
          year: t.year,
          month: t.month,
          targetAmount: Number(t.targetAmount),
          achievedAmount: Number(t.achievedAmount),
          achievementPercent:
            Number(t.targetAmount) > 0
              ? (Number(t.achievedAmount) / Number(t.targetAmount)) * 100
              : 0,
        })),
      };
    }

    case "sources": {
      const sources = await prisma.lead.groupBy({
        by: ["source"],
        where: { deletedAt: null, createdAt },
        _count: { _all: true },
        _sum: { estimatedDealValue: true },
      });
      return {
        type: query.type,
        summary: {
          sourceCount: sources.length,
          totalLeads: sources.reduce((s, r) => s + r._count._all, 0),
        },
        rows: sources.map((s) => ({
          source: s.source ?? "Unknown",
          count: s._count._all,
          estimatedValue: Number(s._sum.estimatedDealValue ?? 0),
        })),
      };
    }

    case "roi": {
      const campaigns = await prisma.campaign.findMany({
        where: { deletedAt: null, createdAt },
        include: { metrics: true },
        take: 1000,
      });
      const rows = campaigns.map((c) => {
        const spent = Number(c.spent);
        const revenue = Number(c.metrics?.revenue ?? 0);
        return {
          id: c.id,
          name: c.name,
          channel: c.channel,
          spent,
          revenue,
          leads: c.metrics?.leadCount ?? 0,
          roiPercent: spent > 0 ? ((revenue - spent) / spent) * 100 : null,
        };
      });
      return {
        type: query.type,
        summary: {
          spent: rows.reduce((s, r) => s + r.spent, 0),
          revenue: rows.reduce((s, r) => s + r.revenue, 0),
          campaignCount: rows.length,
        },
        rows,
      };
    }

    case "tickets": {
      const byStatus = await prisma.supportTicket.groupBy({
        by: ["status"],
        where: { deletedAt: null, createdAt },
        _count: { _all: true },
      });
      const byPriority = await prisma.supportTicket.groupBy({
        by: ["priority"],
        where: { deletedAt: null, createdAt },
        _count: { _all: true },
      });
      return {
        type: query.type,
        summary: {
          total: byStatus.reduce((s, r) => s + r._count._all, 0),
        },
        rows: {
          byStatus: byStatus.map((r) => ({
            status: r.status,
            count: r._count._all,
          })),
          byPriority: byPriority.map((r) => ({
            priority: r.priority,
            count: r._count._all,
          })),
        },
      };
    }

    case "invoices": {
      const byPayment = await prisma.invoice.groupBy({
        by: ["paymentStatus"],
        where: { deletedAt: null, issueDate: createdAt },
        _count: { _all: true },
        _sum: { total: true, amountPaid: true },
      });
      return {
        type: query.type,
        summary: {
          count: byPayment.reduce((s, r) => s + r._count._all, 0),
          total: byPayment.reduce((s, r) => s + Number(r._sum.total ?? 0), 0),
          paid: byPayment.reduce(
            (s, r) => s + Number(r._sum.amountPaid ?? 0),
            0,
          ),
        },
        rows: byPayment.map((r) => ({
          paymentStatus: r.paymentStatus,
          count: r._count._all,
          total: Number(r._sum.total ?? 0),
          amountPaid: Number(r._sum.amountPaid ?? 0),
        })),
      };
    }

    case "payments": {
      const payments = await prisma.payment.findMany({
        where: { paidAt: createdAt },
        include: {
          customer: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { paidAt: "desc" },
        take: 5000,
      });
      return {
        type: query.type,
        summary: {
          count: payments.length,
          amount: payments.reduce((s, p) => s + Number(p.amount), 0),
        },
        rows: payments.map((p) => ({
          id: p.id,
          paymentNumber: p.paymentNumber,
          amount: Number(p.amount),
          method: p.method,
          paidAt: p.paidAt,
          customer: p.customer,
          invoice: p.invoice,
        })),
      };
    }

    default:
      throw validationError("Unsupported report type");
  }
}

export async function exportReport(query: ReportQuery) {
  const report = await runReport(query);
  return {
    exportedAt: new Date().toISOString(),
    ...report,
  };
}
