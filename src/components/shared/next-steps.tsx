"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Sticky strip of the most common actions for a record, in plain words. */
export function NextStepsBar({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-1 flex flex-col gap-2 rounded-xl border border-primary/20 bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Next steps
        </p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        {children}
      </div>
    </div>
  );
}

type RecordLink = {
  leadId?: string;
  customerId?: string;
  assignedToId?: string | null;
};

export function QuickTaskDialog({
  open,
  onOpenChange,
  link,
  defaultTitle = "",
  invalidateKeys = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: RecordLink;
  defaultTitle?: string;
  invalidateKeys?: unknown[][];
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(defaultTitle);
  const [dueDate, setDueDate] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDueDate("");
    }
  }, [open, defaultTitle]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          dueAt: dueDate || null,
          leadId: link.leadId,
          customerId: link.customerId,
          assignedToId: link.assignedToId || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Task added");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a follow-up task</DialogTitle>
          <DialogDescription>
            A reminder of what to do next, like a call or a visit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>What needs to be done?</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call back about the quote"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>When?</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Adding…" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PipelineOption = {
  id: string;
  name: string;
  isDefault?: boolean;
  stages: { id: string; name: string; position?: number }[];
};

export function QuickDealDialog({
  open,
  onOpenChange,
  link,
  defaultTitle = "",
  defaultValue,
  invalidateKeys = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: RecordLink;
  defaultTitle?: string;
  defaultValue?: number | string | null;
  invalidateKeys?: unknown[][];
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(defaultTitle);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setValue(defaultValue != null ? String(Number(defaultValue) || "") : "");
    }
  }, [open, defaultTitle, defaultValue]);

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/pipelines");
      return unwrapList<PipelineOption>(res.data);
    },
    enabled: open,
  });

  const pipelines = pipelinesQuery.data ?? [];
  const pipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const firstStage = [...(pipeline?.stages ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  )[0];

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          pipelineId: pipeline?.id,
          stageId: firstStage?.id,
          expectedRevenue: Number(value) || 0,
          leadId: link.leadId,
          customerId: link.customerId,
          assignedToId: link.assignedToId || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Deal added to the deals board");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a deal</DialogTitle>
          <DialogDescription>
            A deal is a possible sale. It appears as a card on the deals board
            {firstStage ? ` in “${firstStage.name}”` : ""}.
          </DialogDescription>
        </DialogHeader>
        {!pipelinesQuery.isLoading && !firstStage ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            The deals board is not set up yet.{" "}
            <Link href="/pipeline" className="font-medium text-primary underline">
              Open the deals board
            </Link>{" "}
            and press “Create default pipeline”.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Deal name</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="10 air purifiers for office"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !firstStage || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Adding…" : "Add deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
