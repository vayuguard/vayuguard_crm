"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckSquare,
  Contact,
  Kanban,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { leadStatusLabel } from "@/lib/labels";
import { usePermissions } from "@/hooks/use-permissions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerBadge } from "@/components/shared/owner-badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

type Person = { id?: string; name?: string | null; email?: string | null } | null;

type Task = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  assignedTo?: Person;
  lead?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
};

type Lead = {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  status: string;
  updatedAt?: string;
  assignedTo?: Person;
};

type Deal = {
  id: string;
  title: string;
  expectedRevenue?: string | number | null;
  expectedCloseDate?: string | null;
  stage?: { name: string; isWon?: boolean; isLost?: boolean } | null;
  assignedTo?: Person;
};

type TeamMember = {
  id: string;
  name?: string | null;
  email?: string | null;
  openLeads: number;
  openTasks: number;
  overdueTasks: number;
};

function startOfTomorrow() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function MyWorkView() {
  const { can, user } = usePermissions();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ["tasks", "my-work"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/tasks?pageSize=100");
      return unwrapList<Task>(res.data);
    },
    enabled: can("tasks:read"),
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", "my-work"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/leads?pageSize=100");
      return unwrapList<Lead>(res.data);
    },
    enabled: can("leads:read"),
  });

  const dealsQuery = useQuery({
    queryKey: ["deals", "my-work"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/deals?pageSize=100");
      return unwrapList<Deal>(res.data);
    },
    enabled: can("deals:read"),
  });

  const teamQuery = useQuery({
    queryKey: ["my-team"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/my-team");
      return unwrapList<TeamMember>(res.data);
    },
  });

  const doneMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      }),
    onSuccess: () => {
      toast.success("Task marked done");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-team"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const tomorrow = startOfTomorrow();
  const now = new Date();
  const openTasks = (tasksQuery.data ?? [])
    .filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS")
    .filter((t) => !t.dueAt || new Date(t.dueAt) < tomorrow)
    .sort((a, b) => {
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });

  const openLeads = (leadsQuery.data ?? [])
    .filter((l) => l.status !== "WON" && l.status !== "LOST")
    .slice(0, 8);

  const openDeals = (dealsQuery.data ?? [])
    .filter((d) => !d.stage?.isWon && !d.stage?.isLost)
    .sort((a, b) => {
      const ad = a.expectedCloseDate
        ? new Date(a.expectedCloseDate).getTime()
        : Infinity;
      const bd = b.expectedCloseDate
        ? new Date(b.expectedCloseDate).getTime()
        : Infinity;
      return ad - bd;
    })
    .slice(0, 6);

  const team = teamQuery.data ?? [];
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you need to do today is on this page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("contacts:write") ? (
            <Link
              href="/contacts?new=1"
              className={buttonVariants({ variant: "outline" })}
            >
              <Contact className="size-4" />
              Add contact
            </Link>
          ) : null}
          {can("leads:write") ? (
            <Link
              href="/leads?new=1"
              className={buttonVariants({ variant: "outline" })}
            >
              <UserPlus className="size-4" />
              Add lead
            </Link>
          ) : null}
          {can("tasks:write") ? (
            <Link href="/tasks?new=1" className={buttonVariants()}>
              <Plus className="size-4" />
              Add task
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {can("tasks:read") ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="size-4 text-primary" />
                To do today
                {openTasks.length ? (
                  <Badge variant="secondary">{openTasks.length}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksQuery.isLoading ? (
                <LoadingSkeleton rows={3} />
              ) : openTasks.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nothing due today. Nice work.
                </p>
              ) : (
                openTasks.map((task) => {
                  const overdue = task.dueAt && new Date(task.dueAt) < now;
                  return (
                    <div
                      key={task.id}
                      className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {task.title}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            overdue
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {task.dueAt
                            ? `${overdue ? "Late — was due" : "Due"} ${formatDate(task.dueAt)}`
                            : "No due date"}
                          {task.lead ? ` · Lead: ${task.lead.name}` : ""}
                          {task.customer
                            ? ` · Customer: ${task.customer.name}`
                            : ""}
                        </p>
                      </div>
                      <OwnerBadge person={task.assignedTo} compact />
                      {can("tasks:write") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={doneMutation.isPending}
                          onClick={() => doneMutation.mutate(task.id)}
                        >
                          <Check className="size-3.5" />
                          Done
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        ) : null}

        {can("leads:read") ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="size-4 text-primary" />
                Open leads
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {leadsQuery.isLoading ? (
                <LoadingSkeleton rows={3} />
              ) : openLeads.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No open leads. Press “Add lead” to start one.
                </p>
              ) : (
                openLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {lead.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[lead.company, lead.phone].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {leadStatusLabel(lead.status)}
                    </Badge>
                    <OwnerBadge
                      person={lead.assignedTo}
                      compact
                      className="hidden sm:inline-flex"
                    />
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              )}
              <Link
                href="/leads"
                className="block px-2.5 pt-1 text-xs font-medium text-primary hover:underline"
              >
                See all leads
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {can("deals:read") ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Kanban className="size-4 text-primary" />
                Deals to move forward
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {dealsQuery.isLoading ? (
                <LoadingSkeleton rows={3} />
              ) : openDeals.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No open deals right now.
                </p>
              ) : (
                openDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href="/pipeline"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {deal.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatCurrency(Number(deal.expectedRevenue ?? 0))}
                        {deal.expectedCloseDate
                          ? ` · Close by ${formatDate(deal.expectedCloseDate)}`
                          : ""}
                      </p>
                    </div>
                    {deal.stage ? (
                      <Badge variant="secondary">{deal.stage.name}</Badge>
                    ) : null}
                    <OwnerBadge
                      person={deal.assignedTo}
                      compact
                      className="hidden sm:inline-flex"
                    />
                  </Link>
                ))
              )}
              <Link
                href="/pipeline"
                className="block px-2.5 pt-1 text-xs font-medium text-primary hover:underline"
              >
                Open deals board
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {team.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                My team
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((member) => (
                <Link
                  key={member.id}
                  href={`/leads?owner=${member.id}`}
                  className="rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <p className="truncate text-sm font-medium">
                    {member.name || member.email}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {member.openLeads} open leads · {member.openTasks} tasks
                    {member.overdueTasks ? (
                      <span className="font-medium text-destructive">
                        {" "}
                        · {member.overdueTasks} late
                      </span>
                    ) : null}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
