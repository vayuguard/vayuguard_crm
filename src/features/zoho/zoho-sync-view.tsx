"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

type ZohoStatus = {
  syncEnabled: boolean;
  syncEnabledEnv: boolean;
  dc: string;
  organizationId: string;
  connection: { ok: boolean; organizationName?: string; error?: string };
  counters: {
    pending: number;
    succeeded: number;
    failed: number;
    dead: number;
  };
  lastSuccess: { createdAt: string; action: string } | null;
  lastError: {
    createdAt: string;
    action: string;
    errorMessage?: string | null;
  } | null;
  pollCursors: {
    contacts: string | null;
    invoices: string | null;
    payments: string | null;
  };
  failedJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    attempts: number;
    lastError: string | null;
    updatedAt: string;
  }>;
};

export function ZohoSyncView() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canWrite = can("settings:write");

  const statusQuery = useQuery({
    queryKey: ["zoho-status"],
    queryFn: async () => {
      const res = await apiFetch<ZohoStatus>("/api/zoho/status");
      return res.data;
    },
    refetchInterval: 15_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (syncEnabled: boolean) => {
      await apiFetch("/api/zoho/status", {
        method: "PATCH",
        body: JSON.stringify({ syncEnabled }),
      });
    },
    onSuccess: () => {
      toast.success("Zoho sync setting updated");
      void qc.invalidateQueries({ queryKey: ["zoho-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await apiFetch("/api/zoho/actions", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("Queued");
      void qc.invalidateQueries({ queryKey: ["zoho-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (statusQuery.isLoading) return <LoadingSkeleton rows={6} />;
  const s = statusQuery.data;
  if (!s) {
    return (
      <EmptyState
        icon={<Unplug className="size-5" />}
        title="Unable to load Zoho status"
        description="Check that you have settings permission and the database is up."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Zoho Books</h2>
          <p className="text-sm text-muted-foreground">
            Inbound only: data flows Zoho → CRM. Nothing you enter in this CRM
            is sent to Zoho. Pulls are rate-limited to avoid API outages.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void statusQuery.refetch()}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending" value={s.counters.pending} />
        <Stat label="Succeeded" value={s.counters.succeeded} />
        <Stat label="Failed" value={s.counters.failed} />
        <Stat label="Dead" value={s.counters.dead} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Connection</p>
              <p className="text-xs text-muted-foreground">
                DC: {s.dc} · Org: {s.organizationId || "—"}
              </p>
            </div>
            <Badge variant={s.connection.ok ? "default" : "destructive"}>
              {s.connection.ok ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          {s.connection.organizationName ? (
            <p className="text-sm">{s.connection.organizationName}</p>
          ) : null}
          {s.connection.error ? (
            <p className="text-sm text-destructive">{s.connection.error}</p>
          ) : null}
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="zoho-sync-toggle">Pull enabled</Label>
              <p className="text-xs text-muted-foreground">
                Env default: {s.syncEnabledEnv ? "true" : "false"}. When on,
                webhooks + scheduled pulls update CRM from Zoho.
              </p>
            </div>
            <Switch
              id="zoho-sync-toggle"
              checked={s.syncEnabled}
              disabled={!canWrite || toggleMutation.isPending}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={!canWrite || actionMutation.isPending}
              onClick={() => actionMutation.mutate({ action: "pull_now" })}
            >
              Pull updates now
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canWrite || actionMutation.isPending}
              onClick={() => actionMutation.mutate({ action: "retry_all" })}
            >
              Retry all failed
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Last activity</p>
          <Detail
            label="Last success"
            value={
              s.lastSuccess
                ? `${s.lastSuccess.action} · ${formatDate(s.lastSuccess.createdAt)}`
                : "—"
            }
          />
          <Detail
            label="Last error"
            value={
              s.lastError
                ? `${s.lastError.action}: ${s.lastError.errorMessage ?? "error"}`
                : "—"
            }
          />
          <Detail
            label="Contact poll cursor"
            value={s.pollCursors.contacts ?? "—"}
          />
          <Detail
            label="Invoice poll cursor"
            value={s.pollCursors.invoices ?? "—"}
          />
          <Detail
            label="Payment poll cursor"
            value={s.pollCursors.payments ?? "—"}
          />
        </section>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Failed jobs</h3>
        {s.failedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed jobs.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Attempts</th>
                  <th className="px-3 py-2 font-medium">Error</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {s.failedJobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {job.jobType}
                    </td>
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="px-3 py-2">{job.attempts}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-destructive">
                      {job.lastError ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(job.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canWrite || actionMutation.isPending}
                        onClick={() =>
                          actionMutation.mutate({
                            action: "retry",
                            jobId: job.id,
                          })
                        }
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
