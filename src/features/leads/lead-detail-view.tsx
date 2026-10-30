"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ExternalLink,
  Kanban,
  Paperclip,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { OwnerBadge } from "@/components/shared/owner-badge";
import {
  NextStepsBar,
  QuickDealDialog,
  QuickTaskDialog,
} from "@/components/shared/next-steps";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUS_ORDER,
  leadStatusLabel,
  priorityLabel,
} from "@/lib/labels";
import * as React from "react";

type LeadDetail = {
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
  status: string;
  priority?: string;
  source?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  estimatedDealValue?: number | string | null;
  expectedClosingDate?: string | null;
  notes?: string | null;
  customerId?: string | null;
  campaign?: { id?: string; name?: string } | null;
  assignedToId?: string | null;
  assignedTo?: { id?: string; name?: string | null; email?: string | null } | null;
  tags?: { tag?: { name?: string } | null }[] | null;
  attachments?: Attachment[];
  createdAt?: string;
};

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt?: string;
};

type LinkedTask = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  assignedTo?: { name?: string | null; email?: string | null } | null;
};

type LinkedDeal = {
  id: string;
  title: string;
  expectedRevenue?: string | number | null;
  stage?: { name: string } | null;
};

type Assignee = { id: string; name?: string | null; email?: string | null };

type Activity = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  createdAt?: string;
  user?: { name?: string | null; email?: string | null } | null;
};

export function LeadDetailView({ leadId }: { leadId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [dealOpen, setDealOpen] = React.useState(false);
  const [fileName, setFileName] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");

  const leadQuery = useQuery({
    queryKey: ["leads", leadId],
    queryFn: async () => {
      const res = await apiFetch<LeadDetail>(`/api/leads/${leadId}`);
      return res.data;
    },
  });

  const activitiesQuery = useQuery({
    queryKey: ["leads", leadId, "activities"],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`/api/leads/${leadId}/activities`);
      return unwrapList<Activity>(res.data);
    },
  });

  const attachmentsQuery = useQuery({
    queryKey: ["leads", leadId, "attachments"],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`/api/leads/${leadId}/attachments`);
      return unwrapList<Attachment>(res.data);
    },
  });

  const linkedTasksQuery = useQuery({
    queryKey: ["tasks", "lead", leadId],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`/api/tasks?leadId=${leadId}`);
      return unwrapList<LinkedTask>(res.data);
    },
    enabled: can("tasks:read"),
  });

  const linkedDealsQuery = useQuery({
    queryKey: ["deals", "lead", leadId],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`/api/deals?leadId=${leadId}`);
      return unwrapList<LinkedDeal>(res.data);
    },
    enabled: can("deals:read"),
  });

  const assigneesQuery = useQuery({
    queryKey: ["assignees"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/assignees");
      return unwrapList<Assignee>(res.data);
    },
    enabled: can("leads:write"),
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; assignedToId?: string | null }) =>
      apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_res, data) => {
      toast.success(data.status ? "Stage updated" : "Person updated");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const taskDoneMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      }),
    onSuccess: () => {
      toast.success("Task marked done");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const convertMutation = useMutation({
    mutationFn: async () =>
      apiFetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        body: JSON.stringify({ createContact: true }),
      }),
    onSuccess: (res) => {
      toast.success("Lead converted to customer");
      setConvertOpen(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      const customerId = (res.data as { customer?: { id?: string } })?.customer
        ?.id;
      if (customerId) {
        router.push(`/customers/${customerId}`);
      } else {
        leadQuery.refetch();
        activitiesQuery.refetch();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const attachmentMutation = useMutation({
    mutationFn: async () =>
      apiFetch(`/api/leads/${leadId}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          fileName: fileName.trim() || "attachment",
          fileUrl: fileUrl.trim(),
        }),
      }),
    onSuccess: () => {
      toast.success("Attachment added");
      setFileName("");
      setFileUrl("");
      queryClient.invalidateQueries({
        queryKey: ["leads", leadId, "attachments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["leads", leadId, "activities"],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (leadQuery.isLoading) return <LoadingSkeleton rows={8} />;

  if (leadQuery.isError || !leadQuery.data) {
    return (
      <EmptyState
        title="Lead not found"
        description={
          (leadQuery.error as Error)?.message ?? "Unable to load lead."
        }
        action={
          <Button variant="outline" onClick={() => router.push("/leads")}>
            Back to leads
          </Button>
        }
      />
    );
  }

  const lead = leadQuery.data;
  const activities = activitiesQuery.data ?? [];
  const attachments =
    attachmentsQuery.data ?? lead.attachments ?? [];
  const canConvert =
    can(["leads:write", "customers:write"]) && !lead.customerId;
  const openLinkedTasks = (linkedTasksQuery.data ?? []).filter(
    (t) => t.status === "TODO" || t.status === "IN_PROGRESS",
  );
  const linkedDeals = linkedDealsQuery.data ?? [];
  const leadLink = {
    leadId: lead.id,
    assignedToId: lead.assignedToId ?? lead.assignedTo?.id ?? null,
  };
  const tagNames =
    lead.tags
      ?.map((t) => t.tag?.name)
      .filter((n): n is string => Boolean(n)) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1 text-muted-foreground"
            onClick={() => router.push("/leads")}
          >
            <ArrowLeft className="size-3.5" />
            Leads
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[lead.leadNumber, lead.company].filter(Boolean).join(" · ") ||
              "Lead detail"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OwnerBadge person={lead.assignedTo} />
          <Badge variant="secondary">{leadStatusLabel(lead.status)}</Badge>
          {lead.priority ? (
            <Badge variant="outline">{priorityLabel(lead.priority)} priority</Badge>
          ) : null}
          {lead.customerId ? (
            <Link href={`/customers/${lead.customerId}`}>
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-700"
              >
                Customer now — open
              </Badge>
            </Link>
          ) : null}
        </div>
      </div>

      {can("leads:write") ? (
        <NextStepsBar hint="Update this lead as you talk to the customer.">
          <Select
            value={lead.status}
            items={LEAD_STATUS_ORDER.map((s) => ({
              value: s,
              label: `Stage: ${leadStatusLabel(s)}`,
            }))}
            disabled={updateMutation.isPending}
            onValueChange={(v) => v && updateMutation.mutate({ status: v })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {leadStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assigneesQuery.data?.length ? (
            <Select
              value={lead.assignedToId ?? lead.assignedTo?.id ?? "__none__"}
              items={[
                { value: "__none__", label: "Handled by: nobody" },
                ...assigneesQuery.data.map((a) => ({
                  value: a.id,
                  label: `Handled by: ${a.name || a.email || a.id}`,
                })),
              ]}
              disabled={updateMutation.isPending}
              onValueChange={(v) =>
                updateMutation.mutate({
                  assignedToId: !v || v === "__none__" ? null : v,
                })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Handled by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nobody</SelectItem>
                {assigneesQuery.data.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {can("tasks:write") ? (
            <Button variant="outline" onClick={() => setTaskOpen(true)}>
              <CalendarPlus className="size-4" />
              Add follow-up
            </Button>
          ) : null}
          {can("deals:write") ? (
            <Button variant="outline" onClick={() => setDealOpen(true)}>
              <Kanban className="size-4" />
              Start a deal
            </Button>
          ) : null}
          {canConvert ? (
            <Button onClick={() => setConvertOpen(true)}>
              <UserPlus className="size-4" />
              Make customer
            </Button>
          ) : null}
        </NextStepsBar>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Email" value={lead.email} />
            <Field label="Phone" value={lead.phone} />
            <Field label="WhatsApp" value={lead.whatsapp} />
            <Field label="Website" value={lead.website} />
            <Field label="Industry" value={lead.industry} />
            <Field label="Source" value={lead.source} />
            <Field label="Campaign" value={lead.campaign?.name} />
            <Field
              label="Location"
              value={[lead.city, lead.state, lead.country, lead.pinCode]
                .filter(Boolean)
                .join(", ")}
            />
            <Field label="Address" value={lead.address} />
            <Field
              label="Est. value"
              value={formatCurrency(lead.estimatedDealValue)}
            />
            <Field
              label="Expected close"
              value={formatDate(lead.expectedClosingDate)}
            />
            <Field
              label="Handled by"
              value={lead.assignedTo?.name ?? lead.assignedTo?.email ?? "Nobody yet"}
            />
            <Field label="Created" value={formatDate(lead.createdAt)} />
            {tagNames.length ? (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Tags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {tagNames.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
          {lead.notes ? (
            <>
              <Separator />
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{lead.notes}</p>
              </CardContent>
            </>
          ) : null}
        </Card>

        <div className="space-y-4">
          {can("tasks:read") || can("deals:read") ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Follow-ups &amp; deals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {openLinkedTasks.length === 0 && linkedDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing planned yet. Use “Add follow-up” or “Start a deal”
                    above.
                  </p>
                ) : null}
                {openLinkedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.dueAt ? `Due ${formatDate(task.dueAt)}` : "No due date"}
                        {task.assignedTo
                          ? ` · ${task.assignedTo.name ?? task.assignedTo.email}`
                          : ""}
                      </p>
                    </div>
                    {can("tasks:write") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={taskDoneMutation.isPending}
                        onClick={() => taskDoneMutation.mutate(task.id)}
                      >
                        <Check className="size-3.5" />
                        Done
                      </Button>
                    ) : null}
                  </div>
                ))}
                {linkedDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href="/pipeline"
                    className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 transition-colors hover:bg-muted"
                  >
                    <Kanban className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{deal.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(deal.expectedRevenue)}
                      </p>
                    </div>
                    {deal.stage ? (
                      <Badge variant="secondary">{deal.stage.name}</Badge>
                    ) : null}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesQuery.isLoading ? (
                <LoadingSkeleton rows={4} />
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activities yet.
                </p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-4">
                  {activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[1.28rem] top-1 size-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.type}
                        {a.user?.name ? ` · ${a.user.name}` : ""}
                        {" · "}
                        {formatDate(a.createdAt, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {a.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="size-4 text-primary" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {attachmentsQuery.isLoading ? (
                <LoadingSkeleton rows={2} />
              ) : attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attachments yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {file.fileName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(file.createdAt)}
                          {file.fileType ? ` · ${file.fileType}` : ""}
                        </p>
                      </div>
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Open attachment"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {can("leads:write") ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Add by URL
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      File name
                    </Label>
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="proposal.pdf"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      File URL
                    </Label>
                    <Input
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="https://"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!fileUrl.trim() || attachmentMutation.isPending}
                    onClick={() => attachmentMutation.mutate()}
                  >
                    {attachmentMutation.isPending
                      ? "Adding…"
                      : "Add attachment"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <QuickTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        link={leadLink}
        defaultTitle={`Follow up with ${lead.name}`}
      />
      <QuickDealDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        link={leadLink}
        defaultTitle={lead.company ? `${lead.company} — ${lead.name}` : lead.name}
        defaultValue={lead.estimatedDealValue}
      />

      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title="Convert lead to customer?"
        description={`This will create a customer from ${lead.name} and mark the lead as converted.`}
        confirmLabel="Convert"
        loading={convertMutation.isPending}
        onConfirm={async () => {
          await convertMutation.mutateAsync();
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
