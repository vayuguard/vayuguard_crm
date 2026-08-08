"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

type Employee = {
  id: string;
  name: string;
  email?: string | null;
  role?: { name?: string } | null;
  department?: string | null;
  employeeProfile?: {
    department?: string | null;
    designation?: string | null;
    employeeCode?: string | null;
    phone?: string | null;
    joiningDate?: string | null;
  } | null;
  isActive?: boolean;
};

type EmployeeDetail = Employee & {
  salesTargets?: {
    id: string;
    period: string;
    year: number;
    month?: number | null;
    targetAmount: number | string;
    achievedAmount: number | string;
  }[];
  attendanceRecords?: {
    id: string;
    date: string;
    checkIn?: string | null;
    checkOut?: string | null;
    status?: string;
  }[];
  commissions?: {
    id: string;
    amount: number | string;
    rate: number | string;
    period?: string | null;
    createdAt?: string;
  }[];
};

type LeaderboardRow = {
  userId: string;
  user?: {
    name?: string | null;
    email?: string | null;
    employeeProfile?: { department?: string | null } | null;
  };
  targetAmount?: number;
  achievedAmount?: number;
  commissionAmount?: number;
  achievementPercent?: number;
};

export function EmployeesView() {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const leaderboard = useQuery({
    queryKey: ["employees", "leaderboard"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/employees/leaderboard");
      return unwrapList<LeaderboardRow>(res.data);
    },
  });

  const listQuery = useQuery({
    queryKey: ["employees", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await apiFetch<unknown>(`/api/employees?${params}`);
      return unwrapList<Employee>(res.data);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["employees", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await apiFetch<EmployeeDetail>(`/api/employees/${selectedId}`);
      return res.data;
    },
  });

  const columns: DataTableColumn<Employee>[] = [
    {
      id: "name",
      header: "Employee",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.email ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (r) => r.role?.name ?? "—",
    },
    {
      id: "department",
      header: "Department",
      cell: (r) => r.employeeProfile?.department ?? r.department ?? "—",
    },
    {
      id: "designation",
      header: "Designation",
      cell: (r) => r.employeeProfile?.designation ?? "—",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.isActive === false ? "outline" : "secondary"}>
          {r.isActive === false ? "Inactive" : "Active"}
        </Badge>
      ),
    },
  ];

  const top = leaderboard.data ?? [];
  const employees = listQuery.data ?? [];
  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Trophy className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Sales leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.isLoading ? (
            <LoadingSkeleton rows={3} />
          ) : top.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leaderboard data for this period.
            </p>
          ) : (
            <div className="space-y-2">
              {top.slice(0, 8).map((row, index) => (
                <div
                  key={row.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {row.user?.name ?? row.user?.email ?? row.userId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.user?.employeeProfile?.department ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-primary">
                      {formatCurrency(row.achievedAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.achievementPercent != null
                        ? `${Number(row.achievementPercent).toFixed(0)}% of target`
                        : `Target ${formatCurrency(row.targetAmount)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="max-w-xs"
          />
          {listQuery.isLoading ? (
            <LoadingSkeleton rows={5} />
          ) : listQuery.isError ? (
            <EmptyState
              title="Failed to load employees"
              description={(listQuery.error as Error).message}
            />
          ) : (
            <DataTable
              columns={columns}
              data={employees}
              getRowId={(r) => r.id}
              onRowClick={(r) => setSelectedId(r.id)}
              emptyTitle="No employees"
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {!selectedId ? (
            <EmptyState
              title="Select an employee"
              description="View profile, attendance, targets, and commissions."
            />
          ) : detailQuery.isLoading ? (
            <LoadingSkeleton rows={6} />
          ) : !detail ? (
            <EmptyState title="Employee not found" />
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">{detail.name}</h3>
                <p className="text-sm text-muted-foreground">{detail.email}</p>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <Detail
                  label="Code"
                  value={detail.employeeProfile?.employeeCode}
                />
                <Detail label="Role" value={detail.role?.name} />
                <Detail
                  label="Department"
                  value={detail.employeeProfile?.department}
                />
                <Detail
                  label="Designation"
                  value={detail.employeeProfile?.designation}
                />
                <Detail label="Phone" value={detail.employeeProfile?.phone} />
                <Detail
                  label="Joined"
                  value={formatDate(detail.employeeProfile?.joiningDate)}
                />
              </dl>

              <Section title="Sales targets">
                {(detail.salesTargets ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No targets.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.salesTargets?.slice(0, 6).map((t) => (
                      <li
                        key={t.id}
                        className="flex justify-between gap-2 text-sm"
                      >
                        <span>
                          {t.period} {t.year}
                          {t.month ? `/${t.month}` : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(t.achievedAmount)} /{" "}
                          {formatCurrency(t.targetAmount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Attendance">
                {(detail.attendanceRecords ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No records.</p>
                ) : (
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                    {detail.attendanceRecords?.slice(0, 15).map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-2 text-sm"
                      >
                        <span>{formatDate(a.date)}</span>
                        <span className="text-muted-foreground">
                          {a.status ?? "present"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Commissions">
                {(detail.commissions ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No commissions.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.commissions?.slice(0, 8).map((c) => (
                      <li
                        key={c.id}
                        className="flex justify-between gap-2 text-sm"
                      >
                        <span>{c.period ?? formatDate(c.createdAt)}</span>
                        <span className="font-medium text-primary">
                          {formatCurrency(c.amount)} ({Number(c.rate)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedId(null)}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}
