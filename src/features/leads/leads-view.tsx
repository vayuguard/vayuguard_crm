"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  GitMerge,
  LayoutGrid,
  List,
  Pencil,
  Pin,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  LeadForm,
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  type LeadFormValues,
} from "@/features/leads/lead-form";

export type Lead = {
  id: string;
  leadNumber?: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  industry?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  status: string;
  priority?: string;
  source?: string | null;
  campaignId?: string | null;
  assignedToId?: string | null;
  notes?: string | null;
  estimatedDealValue?: number | string | null;
  expectedClosingDate?: string | null;
  tags?: { tag?: { name?: string } | null }[] | null;
  createdAt?: string;
};

type SavedView = {
  id: string;
  name: string;
  module: string;
  filters: Record<string, unknown>;
  isPinned?: boolean;
};

type ViewMode = "table" | "kanban";

type Employee = { id: string; name?: string | null; email?: string | null };
type Campaign = { id: string; name: string };

function toPayload(values: LeadFormValues) {
  return {
    name: values.name,
    company: values.company || null,
    industry: values.industry || null,
    email: values.email || null,
    phone: values.phone || null,
    whatsapp: values.whatsapp || null,
    website: values.website || null,
    address: values.address || null,
    city: values.city || null,
    state: values.state || null,
    country: values.country || null,
    pinCode: values.pinCode || null,
    source: values.source || null,
    campaignId: values.campaignId || null,
    assignedToId: values.assignedToId || null,
    status: values.status,
    priority: values.priority,
    estimatedDealValue: values.estimatedDealValue ?? null,
    expectedClosingDate: values.expectedClosingDate || null,
    notes: values.notes || null,
    tags: values.tags || null,
  };
}

function tagsToString(lead: Lead): string {
  if (!lead.tags?.length) return "";
  return lead.tags
    .map((t) => t.tag?.name)
    .filter(Boolean)
    .join(", ");
}

export function LeadsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [view, setView] = React.useState<ViewMode>("table");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [priority, setPriority] = React.useState<string>("all");
  const [source, setSource] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [deleting, setDeleting] = React.useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState<string>("");
  const [bulkPriority, setBulkPriority] = React.useState<string>("");
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [primaryId, setPrimaryId] = React.useState<string>("");
  const [saveViewOpen, setSaveViewOpen] = React.useState(false);
  const [viewName, setViewName] = React.useState("");
  const [pinView, setPinView] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["leads", search, status, priority, source],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (status !== "all") params.set("status", status);
      if (priority !== "all") params.set("priority", priority);
      if (source.trim()) params.set("source", source.trim());
      const res = await apiFetch<unknown>(`/api/leads?${params}`);
      return unwrapList<Lead>(res.data);
    },
  });

  const savedViewsQuery = useQuery({
    queryKey: ["saved-views", "leads"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/saved-views?module=leads");
      return unwrapList<SavedView>(res.data);
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", "assignees"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/employees?pageSize=100");
      return unwrapList<Employee>(res.data);
    },
    enabled: can("employees:read"),
    retry: false,
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", "options"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/campaigns?pageSize=100");
      return unwrapList<Campaign>(res.data);
    },
    enabled: can("campaigns:read"),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const body = toPayload(values);
      if (editing) {
        return apiFetch(`/api/leads/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Lead updated" : "Lead created");
      setDialogOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lead deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const data: Record<string, string> = {};
      if (bulkStatus) data.status = bulkStatus;
      if (bulkPriority) data.priority = bulkPriority;
      if (!Object.keys(data).length) {
        throw new Error("Select at least one field to update");
      }
      return apiFetch("/api/leads/bulk", {
        method: "PATCH",
        body: JSON.stringify({
          ids: [...selectedIds],
          data,
        }),
      });
    },
    onSuccess: () => {
      toast.success(`Updated ${selectedIds.size} leads`);
      setSelectedIds(new Set());
      setBulkStatus("");
      setBulkPriority("");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const secondaryIds = [...selectedIds].filter((id) => id !== primaryId);
      if (!primaryId || secondaryIds.length === 0) {
        throw new Error("Select a primary lead and at least one other lead");
      }
      return apiFetch("/api/leads/merge", {
        method: "POST",
        body: JSON.stringify({
          primaryId,
          mergeIds: secondaryIds,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Leads merged");
      setMergeOpen(false);
      setSelectedIds(new Set());
      setPrimaryId("");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveViewMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/saved-views", {
        method: "POST",
        body: JSON.stringify({
          name: viewName.trim(),
          module: "leads",
          isPinned: pinView,
          filters: {
            q: search || undefined,
            status: status !== "all" ? status : undefined,
            priority: priority !== "all" ? priority : undefined,
            source: source.trim() || undefined,
          },
        }),
      }),
    onSuccess: () => {
      toast.success("View saved");
      setSaveViewOpen(false);
      setViewName("");
      queryClient.invalidateQueries({ queryKey: ["saved-views", "leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leads = query.data ?? [];
  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));
  const allSelected =
    leads.length > 0 && leads.every((l) => selectedIds.has(l.id));

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applySavedView = (saved: SavedView) => {
    const filters = saved.filters ?? {};
    setSearch(typeof filters.q === "string" ? filters.q : "");
    setStatus(typeof filters.status === "string" ? filters.status : "all");
    setPriority(
      typeof filters.priority === "string" ? filters.priority : "all",
    );
    setSource(typeof filters.source === "string" ? filters.source : "");
    toast.success(`Applied view “${saved.name}”`);
  };

  const assignees = (employeesQuery.data ?? []).map((e) => ({
    id: e.id,
    label: e.name || e.email || e.id,
  }));
  const campaigns = (campaignsQuery.data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const columns: DataTableColumn<Lead>[] = [
    {
      id: "select",
      header: "",
      headerClassName: "w-10",
      className: "w-10",
      cell: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(row.id)}
            onCheckedChange={(v) => toggleSelect(row.id, Boolean(v))}
            aria-label={`Select ${row.name}`}
          />
        </div>
      ),
    },
    {
      id: "lead",
      header: "Lead",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.leadNumber ?? row.company ?? "—"}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="text-sm">
          <p>{row.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.phone ?? ""}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant="secondary">{row.status}</Badge>,
    },
    {
      id: "priority",
      header: "Priority",
      cell: (row) => row.priority ?? "—",
    },
    {
      id: "value",
      header: "Value",
      cell: (row) => formatCurrency(row.estimatedDealValue),
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => formatDate(row.createdAt),
    },
    {
      id: "actions",
      header: "",
      className: "w-[1%] text-right",
      cell: (row) => (
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {can("leads:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setEditing(row);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {can("leads:delete") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleting(row)}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const pinnedViews = (savedViewsQuery.data ?? []).filter((v) => v.isPinned);
  const otherViews = (savedViewsQuery.data ?? []).filter((v) => !v.isPinned);

  return (
    <div className="space-y-4">
      {(pinnedViews.length > 0 || otherViews.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Views
          </span>
          {pinnedViews.map((v) => (
            <Button
              key={v.id}
              size="sm"
              variant="secondary"
              onClick={() => applySavedView(v)}
            >
              <Pin className="size-3" />
              {v.name}
            </Button>
          ))}
          {otherViews.map((v) => (
            <Button
              key={v.id}
              size="sm"
              variant="outline"
              onClick={() => applySavedView(v)}
            >
              {v.name}
            </Button>
          ))}
        </div>
      )}

      <FilterBar
        actions={
          <>
            <Button variant="outline" onClick={() => setSaveViewOpen(true)}>
              <Save className="size-4" />
              Save view
            </Button>
            {can("leads:export") ? (
              <Button
                variant="outline"
                onClick={() => window.open("/api/leads/export", "_blank")}
              >
                <Download className="size-4" />
                Export
              </Button>
            ) : null}
            {can("leads:import") ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      await apiFetch("/api/leads/import", {
                        method: "POST",
                        body: JSON.stringify({ csv: text }),
                      });
                      toast.success("Leads imported");
                      queryClient.invalidateQueries({ queryKey: ["leads"] });
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Import failed",
                      );
                    } finally {
                      e.target.value = "";
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Import
                </Button>
              </>
            ) : null}
            {can("leads:write") ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                New lead
              </Button>
            ) : null}
          </>
        }
      >
        <Input
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v ?? "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {LEAD_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="max-w-[140px]"
        />
        <div className="flex rounded-lg border border-border p-0.5">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setView("table")}
            aria-label="Table view"
          >
            <List className="size-3.5" />
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setView("kanban")}
            aria-label="Kanban view"
          >
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>
      </FilterBar>

      {selectedIds.size > 0 && can("leads:write") ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            {selectedIds.size} selected
            <button
              type="button"
              className="ml-2 text-xs text-muted-foreground underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={bulkStatus || undefined}
              onValueChange={(v) => setBulkStatus(v ?? "")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={bulkPriority || undefined}
              onValueChange={(v) => setBulkPriority(v ?? "")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Set priority" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              Bulk update
            </Button>
            {selectedIds.size >= 2 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPrimaryId([...selectedIds][0] ?? "");
                  setMergeOpen(true);
                }}
              >
                <GitMerge className="size-3.5" />
                Merge
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Could not load leads"
          description={
            (query.error as Error)?.message ??
            "Check /api/leads or try again."
          }
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : view === "table" ? (
        <div className="space-y-2">
          {leads.length > 0 ? (
            <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => {
                  if (v) setSelectedIds(new Set(leads.map((l) => l.id)));
                  else setSelectedIds(new Set());
                }}
              />
              Select all on page
            </label>
          ) : null}
          <DataTable
            columns={columns}
            data={leads}
            getRowId={(r) => r.id}
            emptyTitle="No leads found"
            emptyDescription="Create a lead or adjust filters."
            onRowClick={(row) => router.push(`/leads/${row.id}`)}
          />
        </div>
      ) : (
        <LeadsKanban
          leads={leads}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={(lead) => router.push(`/leads/${lead.id}`)}
          onEdit={(lead) => {
            setEditing(lead);
            setDialogOpen(true);
          }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lead" : "Create lead"}</DialogTitle>
          </DialogHeader>
          <LeadForm
            key={editing?.id ?? "new"}
            assignees={assignees}
            campaigns={campaigns}
            defaultValues={
              editing
                ? {
                    name: editing.name,
                    company: editing.company ?? "",
                    industry: editing.industry ?? "",
                    email: editing.email ?? "",
                    phone: editing.phone ?? "",
                    whatsapp: editing.whatsapp ?? "",
                    website: editing.website ?? "",
                    address: editing.address ?? "",
                    city: editing.city ?? "",
                    state: editing.state ?? "",
                    country: editing.country ?? "India",
                    pinCode: editing.pinCode ?? "",
                    status:
                      (editing.status as LeadFormValues["status"]) ?? "NEW",
                    priority:
                      (editing.priority as LeadFormValues["priority"]) ??
                      "MEDIUM",
                    source: editing.source ?? "",
                    campaignId: editing.campaignId ?? null,
                    assignedToId: editing.assignedToId ?? null,
                    notes: editing.notes ?? "",
                    tags: tagsToString(editing),
                    estimatedDealValue: editing.estimatedDealValue
                      ? Number(editing.estimatedDealValue)
                      : undefined,
                    expectedClosingDate: editing.expectedClosingDate
                      ? editing.expectedClosingDate.slice(0, 10)
                      : "",
                  }
                : undefined
            }
            submitting={saveMutation.isPending}
            onCancel={() => setDialogOpen(false)}
            onSubmit={async (values) => {
              await saveMutation.mutateAsync(values);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Merge leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose the primary lead to keep. The other selected leads will be
              merged into it.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Primary lead
              </Label>
              <Select
                value={primaryId}
                onValueChange={(v) => setPrimaryId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select primary" />
                </SelectTrigger>
                <SelectContent>
                  {selectedLeads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.leadNumber ?? l.id.slice(0, 6)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ul className="space-y-1 text-sm">
              {selectedLeads
                .filter((l) => l.id !== primaryId)
                .map((l) => (
                  <li key={l.id} className="text-muted-foreground">
                    Merge: {l.name}
                  </li>
                ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMergeOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!primaryId || mergeMutation.isPending}
                onClick={() => mergeMutation.mutate()}
              >
                {mergeMutation.isPending ? "Merging…" : "Confirm merge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Save current filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">View name</Label>
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="My hot leads"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={pinView}
                onCheckedChange={(v) => setPinView(Boolean(v))}
              />
              Pin this view
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!viewName.trim() || saveViewMutation.isPending}
                onClick={() => saveViewMutation.mutate()}
              >
                {saveViewMutation.isPending ? "Saving…" : "Save view"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete lead?"
        description={`This will remove ${deleting?.name ?? "this lead"}.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

function LeadsKanban({
  leads,
  selectedIds,
  onToggleSelect,
  onOpen,
  onEdit,
}: {
  leads: Lead[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpen: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
}) {
  if (!leads.length) {
    return (
      <EmptyState
        title="No leads on the board"
        description="Create leads to see them by status."
      />
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {LEAD_STATUSES.map((status) => {
        const column = leads.filter((l) => l.status === status);
        return (
          <div
            key={status}
            className="w-64 shrink-0 rounded-xl border border-border bg-muted/30"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold tracking-wide uppercase">
                {status}
              </span>
              <Badge variant="outline">{column.length}</Badge>
            </div>
            <div className="space-y-2 p-2">
              {column.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-lg border border-border bg-card p-2.5 shadow-sm transition-colors hover:border-primary/40"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={(v) =>
                        onToggleSelect(lead.id, Boolean(v))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(lead)}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.company ?? lead.email ?? "—"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-primary">
                      {formatCurrency(lead.estimatedDealValue)}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(lead)}
                  >
                    Quick edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
