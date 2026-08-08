"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  CheckSquare,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DashboardData = {
  metrics?: {
    totalLeads?: number;
    activeLeads?: number;
    todaysFollowUps?: number;
    dealsWon?: number;
    dealsLost?: number;
    monthlyRevenue?: number;
    monthlyRevenueChangePercent?: number;
    wonDealsThisMonth?: number;
    wonRevenueThisMonth?: number;
  };
  widgets?: {
    totalLeads?: { label?: string; value?: number };
    activeLeads?: { label?: string; value?: number };
    todaysFollowUps?: { label?: string; value?: number };
    dealsWon?: { label?: string; value?: number };
    dealsLost?: { label?: string; value?: number };
    monthlyRevenue?: { label?: string; value?: number; previous?: number };
    leadSources?: { data?: { source: string; count: number }[] };
    salesFunnel?: { data?: { status: string; count: number }[] };
    recentActivities?: { data?: ActivityItem[] };
    tasksDue?: { data?: TaskItem[] };
    upcomingMeetings?: { data?: MeetingItem[] };
    employeePerformance?: { data?: PerformanceItem[] };
  };
};

type ActivityItem = {
  id: string;
  type?: string;
  summary?: string;
  title?: string;
  note?: string | null;
  description?: string | null;
  createdAt?: string;
  user?: { name?: string | null } | null;
  lead?: { name?: string | null; leadNumber?: string | null } | null;
};

type TaskItem = {
  id: string;
  title: string;
  dueAt?: string | null;
  dueDate?: string | null;
  priority?: string;
  status?: string;
  assignedTo?: { name?: string | null } | null;
};

type MeetingItem = {
  id: string;
  title: string;
  startsAt?: string;
  startAt?: string;
  location?: string | null;
  organizer?: { name?: string | null } | null;
};

type PerformanceItem = {
  userId?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
  dealsWon?: number;
  revenue?: number;
};

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function DashboardView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await apiFetch<DashboardData>("/api/dashboard");
      return res.data;
    },
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="cards" />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  const metrics = data?.metrics ?? {};
  const widgets = data?.widgets ?? {};

  const totalLeads =
    widgets.totalLeads?.value ?? metrics.totalLeads ?? 0;
  const activeLeads =
    widgets.activeLeads?.value ?? metrics.activeLeads ?? 0;
  const todaysFollowUps =
    widgets.todaysFollowUps?.value ?? metrics.todaysFollowUps ?? 0;
  const dealsWon = widgets.dealsWon?.value ?? metrics.dealsWon ?? 0;
  const dealsLost = widgets.dealsLost?.value ?? metrics.dealsLost ?? 0;
  const monthlyRevenue =
    widgets.monthlyRevenue?.value ?? metrics.monthlyRevenue ?? 0;

  const leadSources =
    widgets.leadSources?.data?.map((d) => ({
      source: d.source,
      count: d.count,
    })) ?? [];
  const funnel =
    widgets.salesFunnel?.data?.map((d) => ({
      status: d.status,
      count: d.count,
    })) ?? [];
  const activities = widgets.recentActivities?.data ?? [];
  const tasks = widgets.tasksDue?.data ?? [];
  const meetings = widgets.upcomingMeetings?.data ?? [];
  const performance = widgets.employeePerformance?.data ?? [];

  const chartSources = leadSources.length
    ? leadSources
    : [{ source: "No data", count: 1 }];
  const chartFunnel = funnel.length
    ? funnel
    : [
        { status: "NEW", count: 0 },
        { status: "QUALIFIED", count: 0 },
        { status: "WON", count: 0 },
      ];

  return (
    <div className="space-y-6">
      {isError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Could not load dashboard metrics. Ensure you have{" "}
          <code>reports:read</code> and the API is running.
        </p>
      ) : null}

      {/* 1–6 metric widgets */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Leads"
          value={totalLeads}
          icon={Users}
          description="All leads in CRM"
        />
        <StatCard
          title="Active Leads"
          value={activeLeads}
          icon={UserCheck}
          description="Not won or lost"
        />
        <StatCard
          title="Today's Follow-ups"
          value={todaysFollowUps}
          icon={CheckSquare}
          description="Calls & reminders due today"
        />
        <StatCard
          title="Deals Won"
          value={dealsWon}
          icon={TrendingUp}
          description={`${metrics.wonDealsThisMonth ?? 0} closed this month`}
        />
        <StatCard
          title="Deals Lost"
          value={dealsLost}
          icon={TrendingDown}
          description="All-time lost deals"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(monthlyRevenue)}
          icon={IndianRupee}
          trend={
            metrics.monthlyRevenueChangePercent != null
              ? {
                  value: `${metrics.monthlyRevenueChangePercent >= 0 ? "+" : ""}${metrics.monthlyRevenueChangePercent}% vs last month`,
                  positive: metrics.monthlyRevenueChangePercent >= 0,
                }
              : undefined
          }
        />
      </div>

      {/* 7–8 charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sales Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartFunnel}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartSources}
                  dataKey="count"
                  nameKey="source"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {chartSources.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 9–12 list widgets */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              activities.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {item.summary ??
                        item.title ??
                        item.description ??
                        item.note ??
                        item.type ??
                        "Activity"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[item.lead?.name, item.user?.name]
                        .filter(Boolean)
                        .join(" · ") || item.type}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquare className="size-4 text-primary" />
              Tasks Due
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks due</p>
            ) : (
              tasks.slice(0, 8).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Due {formatDate(task.dueAt ?? task.dueDate)}
                      {task.assignedTo?.name
                        ? ` · ${task.assignedTo.name}`
                        : ""}
                    </p>
                  </div>
                  {task.priority ? (
                    <Badge variant="secondary">{task.priority}</Badge>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" />
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming meetings
              </p>
            ) : (
              meetings.slice(0, 8).map((m) => (
                <div key={m.id} className="text-sm">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(m.startsAt ?? m.startAt, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {m.location ? ` · ${m.location}` : ""}
                    {m.organizer?.name ? ` · ${m.organizer.name}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" />
              Employee Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No won deals this month
              </p>
            ) : (
              performance.slice(0, 8).map((row, i) => (
                <div
                  key={row.userId ?? row.user?.id ?? i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.user?.name ?? row.user?.email ?? "Unassigned"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.dealsWon ?? 0} deals won
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {formatCurrency(row.revenue ?? 0)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
