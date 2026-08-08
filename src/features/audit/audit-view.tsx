"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type AuditRow = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  createdAt?: string;
};

const ACTION_FILTERS = [
  "all",
  "LOGIN",
  "CREATE",
  "EDIT",
  "UPDATE",
  "DELETE",
  "EXPORT",
  "PERMISSION",
] as const;

export function AuditView() {
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState<string>("all");

  const query = useQuery({
    queryKey: ["audit", search, action],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (action !== "all") params.set("action", action);
      const res = await apiFetch<unknown>(`/api/audit?${params}`);
      return unwrapList<AuditRow>(res.data);
    },
  });

  const columns: DataTableColumn<AuditRow>[] = [
    {
      id: "action",
      header: "Action",
      cell: (r) => <Badge variant="secondary">{r.action}</Badge>,
    },
    {
      id: "entity",
      header: "Entity",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.entityType ?? "—"}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {r.entityId ?? ""}
          </p>
        </div>
      ),
    },
    {
      id: "user",
      header: "User",
      cell: (r) => r.user?.name ?? r.user?.email ?? "—",
    },
    {
      id: "ip",
      header: "IP Address",
      cell: (r) => (
        <span className="font-mono text-xs">{r.ipAddress ?? "—"}</span>
      ),
    },
    {
      id: "when",
      header: "Timestamp",
      cell: (r) =>
        formatDate(r.createdAt, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search audit logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={action} onValueChange={(v) => setAction(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTERS.map((a) => (
              <SelectItem key={a} value={a}>
                {a === "all" ? "All actions" : a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Could not load audit logs"
          description={(query.error as Error).message}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          getRowId={(r) => r.id}
          emptyTitle="No audit events"
          emptyDescription="Login, create, edit, delete, export, and permission changes appear here."
        />
      )}
    </div>
  );
}
