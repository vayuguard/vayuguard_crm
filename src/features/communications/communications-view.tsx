"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { talkTypeLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { OwnerBadge } from "@/components/shared/owner-badge";

const CHANNELS = [
  { value: "PHONE", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "MEETING_NOTE", label: "Visit / meeting" },
] as const;

type Channel = (typeof CHANNELS)[number]["value"];

type TalkMeta = {
  discussed?: string | null;
  currentTopic?: string | null;
  nextToDiscuss?: string | null;
  talkedAt?: string | null;
};

type Communication = {
  id: string;
  type: string;
  subject?: string | null;
  body?: string | null;
  direction?: string;
  leadId?: string | null;
  customerId?: string | null;
  createdAt?: string;
  metadata?: TalkMeta | null;
  author?: { id?: string; name?: string | null; email?: string | null } | null;
  lead?: { id?: string; name?: string; leadNumber?: string } | null;
  customer?: { id?: string; name?: string; customerNumber?: string } | null;
};

type LeadOption = { id: string; name: string; leadNumber?: string };
type CustomerOption = { id: string; name: string; customerNumber?: string };

type FormValues = {
  type: Channel;
  direction: "inbound" | "outbound";
  discussed: string;
  currentTopic: string;
  nextToDiscuss: string;
  talkedAt: string;
  leadId: string;
  customerId: string;
};

function toLocalInputValue(iso?: string | null) {
  if (!iso) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm(): FormValues {
  return {
    type: "PHONE",
    direction: "outbound",
    discussed: "",
    currentTopic: "",
    nextToDiscuss: "",
    talkedAt: toLocalInputValue(),
    leadId: "",
    customerId: "",
  };
}

function channelLabel(type?: string | null) {
  const found = CHANNELS.find((c) => c.value === type);
  if (found) return found.label;
  return talkTypeLabel(type);
}

function talkWhen(row: Communication) {
  return row.metadata?.talkedAt || row.createdAt;
}

function formatWhen(value?: string | null) {
  return formatDate(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildBody(values: FormValues) {
  const parts: string[] = [];
  if (values.discussed.trim()) {
    parts.push(`What we talked about:\n${values.discussed.trim()}`);
  }
  if (values.currentTopic.trim()) {
    parts.push(`Currently talking about:\n${values.currentTopic.trim()}`);
  }
  if (values.nextToDiscuss.trim()) {
    parts.push(`Still need to talk about:\n${values.nextToDiscuss.trim()}`);
  }
  return parts.join("\n\n") || null;
}

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
      params.set("pageSize", "100");
      params.set("order", "desc");
      const res = await apiFetch<unknown>(`/api/communications?${params}`);
      return unwrapList<Communication>(res.data);
    },
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", "message-picker"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/leads?pageSize=100");
      return unwrapList<LeadOption>(res.data);
    },
    enabled: dialogOpen,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "message-picker"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/customers?pageSize=100");
      return unwrapList<CustomerOption>(res.data);
    },
    enabled: dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const discussed = values.discussed.trim();
      const currentTopic = values.currentTopic.trim();
      const nextToDiscuss = values.nextToDiscuss.trim();
      if (!discussed && !currentTopic && !nextToDiscuss) {
        throw new Error("Write at least one of the talk sections");
      }
      const talkedAt = values.talkedAt
        ? new Date(values.talkedAt).toISOString()
        : new Date().toISOString();
      const who =
        leadsQuery.data?.find((l) => l.id === values.leadId)?.name ||
        customersQuery.data?.find((c) => c.id === values.customerId)?.name ||
        "client";

      return apiFetch("/api/communications", {
        method: "POST",
        body: JSON.stringify({
          type: values.type,
          direction: values.direction,
          subject: `${channelLabel(values.type)} with ${who}`,
          body: buildBody(values),
          leadId: values.leadId || null,
          customerId: values.customerId || null,
          metadata: {
            discussed: discussed || null,
            currentTopic: currentTopic || null,
            nextToDiscuss: nextToDiscuss || null,
            talkedAt,
          },
        }),
      });
    },
    onSuccess: () => {
      toast.success("Talk saved");
      setDialogOpen(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = [...(query.data ?? [])].sort((a, b) => {
    const at = new Date(talkWhen(a) ?? 0).getTime();
    const bt = new Date(talkWhen(b) ?? 0).getTime();
    return bt - at;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search talks…"
          className="max-w-xs"
        />
        <Button
          onClick={() => {
            setForm(emptyForm());
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Log a talk
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Record who talked, what was said, what is being discussed now, and what
        still needs to be covered — with the exact time.
      </p>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Could not load messages"
          description={(query.error as Error).message}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No talks yet"
          description="Press “Log a talk” after a call, WhatsApp, or visit."
          action={
            <Button
              onClick={() => {
                setForm(emptyForm());
                setDialogOpen(true);
              }}
            >
              <MessageSquarePlus className="size-4" />
              Log a talk
            </Button>
          }
        />
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-4">
          {rows.map((row) => {
            const meta = (row.metadata ?? {}) as TalkMeta;
            const discussed = meta.discussed?.trim();
            const currentTopic = meta.currentTopic?.trim();
            const nextToDiscuss = meta.nextToDiscuss?.trim();
            const hasStructured =
              discussed || currentTopic || nextToDiscuss;
            const withName =
              row.lead?.name || row.customer?.name || null;
            const href = row.leadId
              ? `/leads/${row.leadId}`
              : row.customerId
                ? `/customers/${row.customerId}`
                : null;

            return (
              <li key={row.id} className="relative">
                <span className="absolute -left-[1.28rem] top-3 size-2.5 rounded-full bg-primary" />
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {channelLabel(row.type)}
                          </Badge>
                          <Badge variant="outline">
                            {row.direction === "inbound"
                              ? "They contacted us"
                              : "We contacted them"}
                          </Badge>
                          {withName ? (
                            href ? (
                              <Link
                                href={href}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {withName}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium">
                                {withName}
                              </span>
                            )
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatWhen(talkWhen(row))}
                          {meta.talkedAt &&
                          row.createdAt &&
                          meta.talkedAt !== row.createdAt
                            ? ` · logged ${formatWhen(row.createdAt)}`
                            : ""}
                        </p>
                      </div>
                      <OwnerBadge person={row.author} label="Logged by" />
                    </div>

                    {hasStructured ? (
                      <div className="grid gap-2">
                        {discussed ? (
                          <TalkBlock
                            label="What we talked about"
                            tone="past"
                            text={discussed}
                          />
                        ) : null}
                        {currentTopic ? (
                          <TalkBlock
                            label="Currently talking about"
                            tone="now"
                            text={currentTopic}
                          />
                        ) : null}
                        {nextToDiscuss ? (
                          <TalkBlock
                            label="Still need to talk about"
                            tone="next"
                            text={nextToDiscuss}
                          />
                        ) : null}
                      </div>
                    ) : row.body || row.subject ? (
                      <div className="space-y-1">
                        {row.subject ? (
                          <p className="text-sm font-medium">{row.subject}</p>
                        ) : null}
                        {row.body ? (
                          <p className="whitespace-pre-wrap text-sm text-foreground/90">
                            {row.body}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Log a talk</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="How did you talk?">
                <Select
                  value={form.type}
                  items={CHANNELS.map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      type: (v as Channel) ?? "PHONE",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Who started?">
                <Select
                  value={form.direction}
                  items={[
                    { value: "outbound", label: "We contacted them" },
                    { value: "inbound", label: "They contacted us" },
                  ]}
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
                    <SelectItem value="outbound">We contacted them</SelectItem>
                    <SelectItem value="inbound">They contacted us</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="When did this talk happen?">
              <Input
                type="datetime-local"
                value={form.talkedAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, talkedAt: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                This time is shown on the timeline so everyone’s notes stay in
                sync.
              </p>
            </Field>

            <Field label="What did you talk about?">
              <Textarea
                rows={3}
                value={form.discussed}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discussed: e.target.value }))
                }
                placeholder="Price, delivery date, product demo…"
              />
            </Field>
            <Field label="What are you currently talking about?">
              <Textarea
                rows={2}
                value={form.currentTopic}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currentTopic: e.target.value }))
                }
                placeholder="Waiting for their approval on the quote…"
              />
            </Field>
            <Field label="What do we still need to talk about?">
              <Textarea
                rows={2}
                value={form.nextToDiscuss}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nextToDiscuss: e.target.value }))
                }
                placeholder="Payment terms, installation schedule…"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lead (optional)">
                <Select
                  value={form.leadId || "__none__"}
                  items={[
                    { value: "__none__", label: "No lead" },
                    ...(leadsQuery.data ?? []).map((l) => ({
                      value: l.id,
                      label: l.leadNumber
                        ? `${l.leadNumber} · ${l.name}`
                        : l.name,
                    })),
                  ]}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      leadId: !v || v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No lead</SelectItem>
                    {(leadsQuery.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.leadNumber
                          ? `${l.leadNumber} · ${l.name}`
                          : l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Customer (optional)">
                <Select
                  value={form.customerId || "__none__"}
                  items={[
                    { value: "__none__", label: "No customer" },
                    ...(customersQuery.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.customerNumber
                        ? `${c.customerNumber} · ${c.name}`
                        : c.name,
                    })),
                  ]}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      customerId: !v || v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No customer</SelectItem>
                    {(customersQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.customerNumber
                          ? `${c.customerNumber} · ${c.name}`
                          : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {createMutation.isPending ? "Saving…" : "Save talk"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TalkBlock({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "past" | "now" | "next";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "past" && "border-border bg-muted/40",
        tone === "now" && "border-primary/25 bg-primary/5",
        tone === "next" && "border-amber-300/60 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{text}</p>
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
