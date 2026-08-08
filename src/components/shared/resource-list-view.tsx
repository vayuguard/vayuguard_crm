"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, unwrapList } from "@/lib/api-client";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as React from "react";

type ResourceListViewProps<T extends { id: string }> = {
  queryKey: string;
  endpoint: string;
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: React.ReactNode;
};

export function ResourceListView<T extends { id: string }>({
  queryKey,
  endpoint,
  columns,
  searchPlaceholder = "Search…",
  emptyTitle = "No records found",
  emptyDescription = "Data will appear here once the API returns results.",
  toolbar,
}: ResourceListViewProps<T>) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: [queryKey, debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      const url = params.size ? `${endpoint}?${params}` : endpoint;
      const res = await apiFetch<unknown>(url);
      return unwrapList<T>(res.data);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-xs"
        />
        {toolbar}
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load"
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
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      )}
    </div>
  );
}
