"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LinkPayload = {
  link: {
    zohoId: string;
    lastSyncedAt?: string | null;
    zohoLastModified?: string | null;
  } | null;
  recentLogs: Array<{
    id: string;
    action: string;
    status: string;
    errorMessage?: string | null;
    createdAt: string;
  }>;
};

export function ZohoSyncBadge({
  entityType,
  crmId,
}: {
  entityType: "customer" | "invoice" | "quotation" | "payment";
  crmId: string;
}) {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canSync = can("settings:write") || can("customers:write");

  const query = useQuery({
    queryKey: ["zoho-link", entityType, crmId],
    queryFn: async () => {
      const res = await apiFetch<LinkPayload | null>(
        `/api/zoho/link?entityType=${entityType}&crmId=${crmId}`,
      );
      return res.data;
    },
  });

  const syncNow = useMutation({
    mutationFn: async () => {
      await apiFetch("/api/zoho/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "sync_now",
          entityType,
          crmId,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Sync queued");
      void qc.invalidateQueries({ queryKey: ["zoho-link", entityType, crmId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const link = query.data?.link;
  const lastLog = query.data?.recentLogs?.[0];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="text-xs text-muted-foreground">Zoho</span>
      {link ? (
        <Badge variant="secondary">Linked · {link.zohoId.slice(-8)}</Badge>
      ) : (
        <Badge variant="outline">Not linked</Badge>
      )}
      {link?.lastSyncedAt ? (
        <span className="text-xs text-muted-foreground">
          Synced {formatDate(link.lastSyncedAt)}
        </span>
      ) : null}
      {lastLog?.status === "failed" ? (
        <span className="text-xs text-destructive">
          {lastLog.errorMessage ?? "Last sync failed"}
        </span>
      ) : null}
      {canSync ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={syncNow.isPending}
          onClick={() => syncNow.mutate()}
        >
          <RefreshCw className="size-3.5" />
          Sync now
        </Button>
      ) : null}
    </div>
  );
}
