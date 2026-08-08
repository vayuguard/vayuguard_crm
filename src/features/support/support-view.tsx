"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

type Ticket = {
  id: string;
  ticketNumber?: string;
  subject?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  department?: string | null;
  customerId?: string | null;
  assignedToId?: string | null;
  slaDueAt?: string | null;
  internalNotes?: string | null;
  customer?: { name?: string } | null;
  assignedTo?: { name?: string } | null;
  createdAt?: string;
  messages?: TicketMessage[];
};

type TicketMessage = {
  id: string;
  body: string;
  isInternal?: boolean;
  createdAt?: string;
  author?: { name?: string | null } | null;
};

type TicketForm = {
  subject: string;
  description: string;
  priority: (typeof PRIORITIES)[number];
  department: string;
  customerId: string;
  assignedToId: string;
  slaDueAt: string;
};

const emptyForm: TicketForm = {
  subject: "",
  description: "",
  priority: "MEDIUM",
  department: "",
  customerId: "",
  assignedToId: "",
  slaDueAt: "",
};

function statusClass(status?: string) {
  switch (status) {
    case "RESOLVED":
    case "CLOSED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "IN_PROGRESS":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "WAITING":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "";
  }
}

export function SupportView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<TicketForm>(emptyForm);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messageBody, setMessageBody] = React.useState("");
  const [isInternal, setIsInternal] = React.useState(false);
  const [internalNotes, setInternalNotes] = React.useState("");

  const query = useQuery({
    queryKey: ["tickets", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await apiFetch<unknown>(`/api/tickets?${params}`);
      return unwrapList<Ticket>(res.data);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["tickets", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await apiFetch<Ticket>(`/api/tickets/${selectedId}`);
      return res.data;
    },
  });

  React.useEffect(() => {
    setInternalNotes(detailQuery.data?.internalNotes ?? "");
  }, [detailQuery.data?.internalNotes, selectedId]);

  const createMutation = useMutation({
    mutationFn: async (values: TicketForm) =>
      apiFetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: values.subject,
          description: values.description,
          priority: values.priority,
          department: values.department || null,
          customerId: values.customerId || null,
          assignedToId: values.assignedToId || null,
          slaDueAt: values.slaDueAt || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Ticket created");
      setDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const messageMutation = useMutation({
    mutationFn: async () =>
      apiFetch(`/api/tickets/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: messageBody, isInternal }),
      }),
    onSuccess: () => {
      toast.success(isInternal ? "Internal note added" : "Message sent");
      setMessageBody("");
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ["tickets", selectedId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notesMutation = useMutation({
    mutationFn: async () =>
      apiFetch(`/api/tickets/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({ internalNotes }),
      }),
    onSuccess: () => {
      toast.success("Internal notes saved");
      queryClient.invalidateQueries({ queryKey: ["tickets", selectedId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<Ticket>[] = [
    {
      id: "ticket",
      header: "Ticket",
      cell: (r) => (
        <div>
          <p className="font-medium">
            {r.subject ?? r.title ?? r.ticketNumber ?? r.id}
          </p>
          <p className="text-xs text-muted-foreground">
            {[r.ticketNumber, r.customer?.name].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status ? (
          <Badge variant="outline" className={cn(statusClass(r.status))}>
            {r.status}
          </Badge>
        ) : (
          "—"
        ),
    },
    { id: "priority", header: "Priority", cell: (r) => r.priority ?? "—" },
    {
      id: "assignee",
      header: "Assignee",
      cell: (r) => r.assignedTo?.name ?? "—",
    },
    { id: "created", header: "Created", cell: (r) => formatDate(r.createdAt) },
  ];

  const tickets = query.data ?? [];
  const detail = detailQuery.data;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="max-w-xs"
          />
          {can("tickets:write") ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New ticket
            </Button>
          ) : null}
        </div>

        {query.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : query.isError ? (
          <EmptyState
            title="Failed to load tickets"
            description={(query.error as Error).message}
          />
        ) : (
          <DataTable
            columns={columns}
            data={tickets}
            getRowId={(r) => r.id}
            onRowClick={(r) => setSelectedId(r.id)}
            emptyTitle="No support tickets"
            emptyDescription="Customer support tickets will appear here."
          />
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {!selectedId ? (
          <EmptyState
            title="Select a ticket"
            description="Choose a ticket to view messages and notes."
          />
        ) : detailQuery.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : !detail ? (
          <EmptyState title="Ticket not found" />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {detail.ticketNumber}
              </p>
              <h3 className="text-base font-semibold">{detail.subject}</h3>
              <div className="mt-1 flex flex-wrap gap-2">
                {detail.status ? (
                  <Badge
                    variant="outline"
                    className={cn(statusClass(detail.status))}
                  >
                    {detail.status}
                  </Badge>
                ) : null}
                {detail.priority ? (
                  <Badge variant="secondary">{detail.priority}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {detail.description}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Messages
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {(detail.messages ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  detail.messages?.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        m.isInternal
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {m.author?.name ?? "System"}
                          {m.isInternal ? " · internal" : ""}
                        </span>
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))
                )}
              </div>

              {can("tickets:write") ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!messageBody.trim()) return;
                    messageMutation.mutate();
                  }}
                >
                  <Textarea
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Reply or add a note…"
                    rows={3}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={isInternal}
                        onCheckedChange={(v) => setIsInternal(!!v)}
                      />
                      Internal note
                    </label>
                    <Button type="submit" size="sm" disabled={messageMutation.isPending}>
                      {messageMutation.isPending ? "Sending…" : "Post"}
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>

            {can("tickets:write") ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Internal notes
                </p>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={notesMutation.isPending}
                  onClick={() => notesMutation.mutate()}
                >
                  Save notes
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Create ticket</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.subject.trim() || !form.description.trim()) {
                toast.error("Subject and description are required");
                return;
              }
              createMutation.mutate(form);
            }}
          >
            <Field label="Subject *">
              <Input
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
                required
              />
            </Field>
            <Field label="Description *">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Priority">
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: (v as TicketForm["priority"]) ?? "MEDIUM",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Department">
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                />
              </Field>
              <Field label="Customer ID">
                <Input
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                  placeholder="cuid"
                />
              </Field>
              <Field label="Assigned to ID">
                <Input
                  value={form.assignedToId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assignedToId: e.target.value }))
                  }
                  placeholder="cuid"
                />
              </Field>
              <Field label="SLA due at">
                <Input
                  type="datetime-local"
                  value={form.slaDueAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slaDueAt: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
