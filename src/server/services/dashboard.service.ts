import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { prisma } from "@/server/db/client";

function toNumber(value: unknown) {
  if (value == null) return 0;
  return Number(value);
}

export async function getDashboardData(options?: {
  userId?: string;
  /** Users whose records count (self, or a manager's team). Defaults to [userId]. */
  userIds?: string[];
  scopeToUser?: boolean;
  /** When true, tasks/meetings are limited to the scoped users (employees always). */
  scopePersonalSchedule?: boolean;
}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const ids =
    options?.userIds?.length
      ? options.userIds
      : options?.userId
        ? [options.userId]
        : [];
  const idMatch = { in: ids };

  // Leads/deals: assignee OR creator when scoped.
  const scopeLeadDeal =
    options?.scopeToUser && ids.length
      ? { OR: [{ assignedToId: idMatch }, { createdById: idMatch }] }
      : {};
  const scheduleScoped = !!options?.scopePersonalSchedule && ids.length > 0;
  const myTasks = scheduleScoped
    ? { OR: [{ assignedToId: idMatch }, { createdById: idMatch }] }
    : {};
  const myMeetings = scheduleScoped
    ? { OR: [{ organizerId: idMatch }, { createdById: idMatch }] }
    : {};

  const soft = { deletedAt: null };
  const scopedLeads = { ...soft, ...scopeLeadDeal };

  const [
    totalLeads,
    activeLeads,
    todaysFollowUps,
    dealsWon,
    dealsLost,
    monthlyPayments,
    prevMonthlyPayments,
    leadSources,
    salesFunnel,
    recentActivities,
    tasksDue,
    upcomingMeetings,
    employeePerformanceRaw,
    wonDealsThisMonth,
  ] = await Promise.all([
    // 1. Total Leads
    prisma.lead.count({ where: scopedLeads }),

    // 2. Active Leads (not WON/LOST)
    prisma.lead.count({
      where: {
        ...scopedLeads,
        status: { notIn: ["WON", "LOST"] },
      },
    }),

    // 3. Today's Follow-ups
    prisma.task.count({
      where: {
        ...soft,
        type: { in: ["FOLLOW_UP", "CALL", "REMINDER"] },
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueAt: { gte: todayStart, lte: todayEnd },
        ...myTasks,
      },
    }),

    // 4. Deals Won (all time in won stages)
    prisma.deal.count({
      where: {
        ...soft,
        stage: { isWon: true },
        ...scopeLeadDeal,
      },
    }),

    // 5. Deals Lost
    prisma.deal.count({
      where: {
        ...soft,
        stage: { isLost: true },
        ...scopeLeadDeal,
      },
    }),

    // 6. Monthly Revenue (payments this month)
    prisma.payment.aggregate({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
        ...(options?.scopeToUser && ids.length
          ? { createdById: idMatch }
          : {}),
      },
      _sum: { amount: true },
    }),

    prisma.payment.aggregate({
      where: {
        paidAt: { gte: prevMonthStart, lte: prevMonthEnd },
        ...(options?.scopeToUser && ids.length
          ? { createdById: idMatch }
          : {}),
      },
      _sum: { amount: true },
    }),

    // 7. Lead Sources
    prisma.lead.groupBy({
      by: ["source"],
      where: scopedLeads,
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
    }),

    // 8. Sales Funnel (lead statuses)
    prisma.lead.groupBy({
      by: ["status"],
      where: scopedLeads,
      _count: { _all: true },
    }),

    // 9. Recent Activities
    prisma.leadActivity.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        lead: {
          select: {
            id: true,
            name: true,
            leadNumber: true,
            company: true,
            deletedAt: true,
          },
        },
      },
      where: {
        lead: {
          deletedAt: null,
          ...scopeLeadDeal,
        },
      },
    }),

    // 10. Tasks Due (overdue + next 7 days)
    prisma.task.findMany({
      where: {
        ...soft,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueAt: {
          lte: endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
        },
        ...myTasks,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        lead: { select: { id: true, name: true, leadNumber: true } },
        customer: { select: { id: true, name: true, customerNumber: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),

    // 11. Upcoming Meetings
    prisma.meeting.findMany({
      where: {
        deletedAt: null,
        startsAt: { gte: now },
        ...myMeetings,
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true, image: true },
        },
        lead: { select: { id: true, name: true, leadNumber: true } },
        customer: { select: { id: true, name: true, customerNumber: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 15,
    }),

    // 12. Employee Performance (won deals + revenue by assignee)
    prisma.deal.groupBy({
      by: ["assignedToId"],
      where: {
        ...soft,
        stage: { isWon: true },
        closedAt: { gte: monthStart, lte: monthEnd },
        assignedToId: { not: null },
        ...scopeLeadDeal,
      },
      _count: { _all: true },
      _sum: { expectedRevenue: true },
    }),

    prisma.deal.aggregate({
      where: {
        ...soft,
        stage: { isWon: true },
        closedAt: { gte: monthStart, lte: monthEnd },
        ...scopeLeadDeal,
      },
      _sum: { expectedRevenue: true },
      _count: { _all: true },
    }),
  ]);

  const userIds = employeePerformanceRaw
    .map((r) => r.assignedToId)
    .filter((id): id is string => Boolean(id));

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds }, deletedAt: null },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const monthlyRevenue = toNumber(monthlyPayments._sum.amount);
  const previousMonthRevenue = toNumber(prevMonthlyPayments._sum.amount);
  const wonRevenueThisMonth = toNumber(wonDealsThisMonth._sum.expectedRevenue);

  const funnelOrder = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
    "HOLD",
  ] as const;

  const funnelMap = Object.fromEntries(
    salesFunnel.map((s) => [s.status, s._count._all]),
  );

  return {
    generatedAt: now.toISOString(),
    metrics: {
      totalLeads,
      activeLeads,
      todaysFollowUps,
      dealsWon,
      dealsLost,
      monthlyRevenue,
      previousMonthRevenue,
      monthlyRevenueChangePercent:
        previousMonthRevenue === 0
          ? monthlyRevenue > 0
            ? 100
            : 0
          : Number(
              (
                ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) *
                100
              ).toFixed(1),
            ),
      wonDealsThisMonth: wonDealsThisMonth._count._all,
      wonRevenueThisMonth,
    },
    // Named widgets matching product brief (12 executive metrics)
    widgets: {
      totalLeads: { label: "Total Leads", value: totalLeads },
      activeLeads: { label: "Active Leads", value: activeLeads },
      todaysFollowUps: {
        label: "Today's Follow-ups",
        value: todaysFollowUps,
      },
      dealsWon: { label: "Deals Won", value: dealsWon },
      dealsLost: { label: "Deals Lost", value: dealsLost },
      monthlyRevenue: {
        label: "Monthly Revenue",
        value: monthlyRevenue,
        previous: previousMonthRevenue,
      },
      leadSources: {
        label: "Lead Sources",
        data: leadSources.map((s) => ({
          source: s.source ?? "Unknown",
          count: s._count._all,
        })),
      },
      salesFunnel: {
        label: "Sales Funnel",
        data: funnelOrder.map((status) => ({
          status,
          count: funnelMap[status] ?? 0,
        })),
      },
      recentActivities: {
        label: "Recent Activities",
        data: recentActivities,
      },
      tasksDue: { label: "Tasks Due", data: tasksDue },
      upcomingMeetings: {
        label: "Upcoming Meetings",
        data: upcomingMeetings,
      },
      employeePerformance: {
        label: "Employee Performance",
        data: employeePerformanceRaw.map((row) => ({
          userId: row.assignedToId,
          user: row.assignedToId ? userMap[row.assignedToId] ?? null : null,
          dealsWon: row._count._all,
          revenue: toNumber(row._sum.expectedRevenue),
        })),
      },
    },
  };
}
