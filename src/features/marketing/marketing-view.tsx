"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
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
import { Card, CardContent } from "@/components/ui/card";

const CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;
const STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
  "CANCELLED",
] as const;

type Campaign = {
  id: string;
  name: string;
  channel?: string | null;
  status?: string | null;
  subject?: string | null;
  content?: string | null;
  spent?: number | string | null;
  budget?: number | string | null;
  revenue?: number | string | null;
  roiPercent?: number | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  metrics?: {
    sentCount?: number;
    openCount?: number;
    clickCount?: number;
    replyCount?: number;
    leadCount?: number;
    revenue?: number | string;
  } | null;
};

type CampaignForm = {
  name: string;
  channel: (typeof CHANNELS)[number];
  subject: string;
  content: string;
  budget: string;
  status: (typeof STATUSES)[number];
};

const emptyForm: CampaignForm = {
  name: "",
  channel: "EMAIL",
  subject: "",
  content: "",
  budget: "",
  status: "DRAFT",
};

export function MarketingView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<CampaignForm>(emptyForm);
  const [selected, setSelected] = React.useState<Campaign | null>(null);

  const query = useQuery({
    queryKey: ["campaigns", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await apiFetch<unknown>(`/api/campaigns?${params}`);
      return unwrapList<Campaign>(res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CampaignForm) =>
      apiFetch("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          channel: values.channel,
          subject: values.subject || null,
          content: values.content || null,
          budget: values.budget ? Number(values.budget) : null,
          status: values.status,
        }),
      }),
    onSuccess: () => {
      toast.success("Campaign created");
      setDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<Campaign>[] = [
    {
      id: "name",
      header: "Campaign",
      cell: (r) => (
        <button
          type="button"
          className="text-left"
          onClick={() => setSelected(r)}
        >
          <p className="font-medium hover:underline">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.subject ?? "—"}</p>
        </button>
      ),
    },
    { id: "channel", header: "Channel", cell: (r) => r.channel ?? "—" },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status ? <Badge variant="secondary">{r.status}</Badge> : "—",
    },
    {
      id: "spent",
      header: "Spent",
      cell: (r) => formatCurrency(r.spent),
    },
    {
      id: "revenue",
      header: "Revenue",
      cell: (r) => formatCurrency(r.revenue ?? r.metrics?.revenue),
    },
    {
      id: "roi",
      header: "ROI",
      cell: (r) =>
        r.roiPercent != null ? (
          <span className="font-medium text-primary">
            {Number(r.roiPercent).toFixed(1)}%
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "start",
      header: "Start",
      cell: (r) => formatDate(r.startedAt ?? r.scheduledAt),
    },
  ];

  const campaigns = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns…"
          className="max-w-xs"
        />
        {can("campaigns:write") ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New campaign
          </Button>
        ) : null}
      </div>

      {selected ? (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
            <div className="sm:col-span-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.channel} · {selected.status}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
            <Metric label="Budget" value={formatCurrency(selected.budget)} />
            <Metric label="Spent" value={formatCurrency(selected.spent)} />
            <Metric
              label="Revenue"
              value={formatCurrency(
                selected.revenue ?? selected.metrics?.revenue,
              )}
            />
            <Metric
              label="ROI"
              value={
                selected.roiPercent != null
                  ? `${Number(selected.roiPercent).toFixed(1)}%`
                  : "—"
              }
            />
            <Metric
              label="Sent"
              value={String(selected.metrics?.sentCount ?? 0)}
            />
            <Metric
              label="Opens"
              value={String(selected.metrics?.openCount ?? 0)}
            />
            <Metric
              label="Clicks"
              value={String(selected.metrics?.clickCount ?? 0)}
            />
            <Metric
              label="Leads"
              value={String(selected.metrics?.leadCount ?? 0)}
            />
          </CardContent>
        </Card>
      ) : null}

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load campaigns"
          description={(query.error as Error).message}
        />
      ) : (
        <DataTable
          columns={columns}
          data={campaigns}
          getRowId={(r) => r.id}
          emptyTitle="No campaigns"
          emptyDescription="Marketing campaigns and ROI metrics will show here."
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Create campaign</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) {
                toast.error("Name is required");
                return;
              }
              createMutation.mutate(form);
            }}
          >
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Channel">
                <Select
                  value={form.channel}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      channel: (v as CampaignForm["channel"]) ?? "EMAIL",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: (v as CampaignForm["status"]) ?? "DRAFT",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
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
            <Field label="Content">
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={4}
              />
            </Field>
            <Field label="Budget">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.budget}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budget: e.target.value }))
                }
              />
            </Field>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
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
