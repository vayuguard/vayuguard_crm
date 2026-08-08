"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const TYPES = ["EMAIL", "PHONE", "WHATSAPP", "SMS", "MEETING_NOTE"] as const;

type Communication = {
  id: string;
  type: string;
  subject?: string | null;
  body?: string | null;
  direction?: string;
  leadId?: string | null;
  customerId?: string | null;
  createdAt?: string;
  author?: { name?: string | null } | null;
  lead?: { name?: string } | null;
  customer?: { name?: string } | null;
};

type FormValues = {
  type: (typeof TYPES)[number];
  subject: string;
  body: string;
  direction: "inbound" | "outbound";
  leadId: string;
  customerId: string;
};

const emptyForm: FormValues = {
  type: "EMAIL",
  subject: "",
  body: "",
  direction: "outbound",
  leadId: "",
  customerId: "",
};

export function CommunicationsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(emptyForm);

  const query = useQuery({
    queryKey: ["communications", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await apiFetch<unknown>(`/api/communications?${params}`);
      return unwrapList<Communication>(res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) =>
      apiFetch("/api/communications", {
        method: "POST",
        body: JSON.stringify({
          type: values.type,
          subject: values.subject || null,
          body: values.body || null,
          direction: values.direction,
          leadId: values.leadId || null,
          customerId: values.customerId || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Communication logged");
      setDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<Communication>[] = [
    {
      id: "subject",
      header: "Communication",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.subject || r.body?.slice(0, 60) || "—"}</p>
          <p className="text-xs text-muted-foreground">
            {[r.lead?.name, r.customer?.name, r.author?.name]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (r) => <Badge variant="outline">{r.type}</Badge>,
    },
    {
      id: "direction",
      header: "Direction",
      cell: (r) => r.direction ?? "—",
    },
    {
      id: "created",
      header: "When",
      cell: (r) => formatDate(r.createdAt),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search communications…"
          className="max-w-xs"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Log communication
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: mention teammates with @email or @name in the body to notify them.
      </p>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load communications"
          description={(query.error as Error).message}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          getRowId={(r) => r.id}
          emptyTitle="No communications"
          emptyDescription="Emails, calls, and notes will appear here."
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Log communication</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.subject.trim() && !form.body.trim()) {
                toast.error("Subject or body is required");
                return;
              }
              createMutation.mutate(form);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      type: (v as FormValues["type"]) ?? "EMAIL",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Direction">
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      direction:
                        (v as FormValues["direction"]) ?? "outbound",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Subject">
              <Input
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
              />
            </Field>
            <Field label="Body (use @name to mention)">
              <Textarea
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={4}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lead ID">
                <Input
                  value={form.leadId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leadId: e.target.value }))
                  }
                />
              </Field>
              <Field label="Customer ID">
                <Input
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
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
                {createMutation.isPending ? "Saving…" : "Save"}
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
