"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatISO, subDays } from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, IndianRupee, Target, Users } from "lucide-react";

const REPORT_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "revenue", label: "Revenue" },
  { value: "conversion", label: "Conversion" },
  { value: "performance", label: "Performance" },
  { value: "sources", label: "Sources" },
  { value: "roi", label: "ROI" },
  { value: "tickets", label: "Tickets" },
  { value: "invoices", label: "Invoices" },
  { value: "payments", label: "Payments" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["value"];

type ReportResponse = {
  type: string;
  summary: Record<string, number | string | null | undefined>;
  rows: unknown;
};

function toChartSeries(
  type: ReportType,
  rows: unknown,
): { label: string; value: number }[] {
  if (Array.isArray(rows)) {
    return rows.slice(0, 12).map((row) => {
      const r = row as Record<string, unknown>;
      if (type === "conversion" || type === "tickets") {
        return {
          label: String(r.status ?? r.label ?? "—"),
          value: Number(r.count ?? r.value ?? 0),
        };
      }
      if (type === "sources") {
        return {
          label: String(r.source ?? "—"),
          value: Number(r.count ?? 0),
        };
      }
      if (type === "roi") {
        return {
          label: String(r.name ?? "—"),
          value: Number(r.revenue ?? r.roiPercent ?? 0),
        };
      }
      if (type === "performance") {
        return {
          label: String(
            (r.user as { name?: string } | undefined)?.name ?? r.userId ?? "—",
          ),
          value: Number(r.achievedAmount ?? 0),
        };
      }
      if (type === "invoices") {
        return {
          label: String(r.paymentStatus ?? "—"),
          value: Number(r.total ?? r.count ?? 0),
        };
      }
      if (type === "payments") {
        return {
          label: String(r.paymentNumber ?? r.method ?? "—"),
          value: Number(r.amount ?? 0),
        };
      }
      if (type === "sales") {
        return {
          label: String(r.title ?? "—").slice(0, 16),
          value: Number(r.expectedRevenue ?? 0),
        };
      }
      if (type === "revenue") {
        return {
          label: String(r.invoiceNumber ?? "—"),
          value: Number(r.total ?? 0),
        };
      }
      return {
        label: String(r.label ?? r.name ?? r.id ?? "—"),
        value: Number(r.value ?? r.count ?? 0),
      };
    });
  }

  if (rows && typeof rows === "object" && "byStatus" in (rows as object)) {
    const byStatus = (rows as { byStatus: { status: string; count: number }[] })
      .byStatus;
    return byStatus.map((r) => ({ label: r.status, value: r.count }));
  }

  return [];
}

function summaryCards(type: ReportType, summary: ReportResponse["summary"]) {
  const entries = Object.entries(summary).slice(0, 4);
  const icons = [Users, Target, IndianRupee, BarChart3];
  return entries.map(([key, value], i) => {
    const Icon = icons[i % icons.length];
    const isMoney =
      /revenue|amount|total|spent|invoiced|collected|pipeline|wonRevenue|target|achieved/i.test(
        key,
      );
    const isPercent = /rate|percent|conversion/i.test(key);
    let display: string | number = value ?? "—";
    if (typeof value === "number") {
      if (isMoney) display = formatCurrency(value);
      else if (isPercent) display = `${value.toFixed(1)}%`;
      else display = value;
    }
    return {
      title: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value: display,
      icon: Icon,
    };
  });
}

export function ReportsView() {
  const [type, setType] = React.useState<ReportType>("sales");
  const [from, setFrom] = React.useState(
    formatISO(subDays(new Date(), 90), { representation: "date" }),
  );
  const [to, setTo] = React.useState(
    formatISO(new Date(), { representation: "date" }),
  );

  const query = useQuery({
    queryKey: ["reports", type, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ type, from, to });
      const res = await apiFetch<ReportResponse>(`/api/reports?${params}`);
      return res.data;
    },
  });

  const series = toChartSeries(type, query.data?.rows);
  const cards = summaryCards(type, query.data?.summary ?? {});

  const tableRows = React.useMemo(() => {
    const rows = query.data?.rows;
    if (Array.isArray(rows)) {
      return rows.map((row, i) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? `${i}`),
          ...Object.fromEntries(
            Object.entries(r).map(([k, v]) => [
              k,
              typeof v === "object" && v !== null
                ? JSON.stringify(v)
                : v == null
                  ? "—"
                  : String(v),
            ]),
          ),
        };
      });
    }
    if (rows && typeof rows === "object" && "byStatus" in (rows as object)) {
      const data = rows as {
        byStatus: { status: string; count: number }[];
        byPriority: { priority: string; count: number }[];
      };
      return [
        ...data.byStatus.map((r, i) => ({
          id: `s-${i}`,
          dimension: "status",
          label: r.status,
          count: String(r.count),
        })),
        ...data.byPriority.map((r, i) => ({
          id: `p-${i}`,
          dimension: "priority",
          label: r.priority,
          count: String(r.count),
        })),
      ];
    }
    return [];
  }, [query.data?.rows]);

  const tableColumns: DataTableColumn<(typeof tableRows)[number]>[] =
    React.useMemo(() => {
      if (!tableRows.length) return [];
      const keys = Object.keys(tableRows[0]).filter((k) => k !== "id");
      return keys.slice(0, 6).map((key) => ({
        id: key,
        header: key,
        cell: (row: (typeof tableRows)[number]) =>
          String((row as Record<string, string>)[key] ?? "—"),
      }));
    }, [tableRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Report type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType((v as ReportType) ?? "sales")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["csv", "Export CSV"],
              ["xlsx", "Export Excel"],
              ["pdf", "Export PDF"],
            ] as const
          ).map(([format, label]) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams({ type, from, to, format });
                window.open(`/api/reports/export?${params}`, "_blank");
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <LoadingSkeleton variant="cards" />
      ) : query.isError ? (
        <EmptyState
          title="Could not load report"
          description={(query.error as Error).message}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          {cards.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((c) => (
                <StatCard
                  key={c.title}
                  title={c.title}
                  value={c.value}
                  icon={c.icon}
                />
              ))}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {REPORT_TYPES.find((t) => t.value === type)?.label} chart
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      fill="var(--chart-1, var(--primary))"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No chart data for this range.
                </p>
              )}
            </CardContent>
          </Card>

          {tableRows.length && tableColumns.length ? (
            <DataTable
              columns={tableColumns}
              data={tableRows}
              getRowId={(r) => r.id}
              emptyTitle="No rows"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
