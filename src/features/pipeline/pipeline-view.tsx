"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type PipelineStage = {
  id: string;
  name: string;
  slug?: string;
  position?: number;
  color?: string | null;
  probability?: number;
};

type Pipeline = {
  id: string;
  name: string;
  isDefault?: boolean;
  stages: PipelineStage[];
};

type Deal = {
  id: string;
  title: string;
  value?: number | string | null;
  expectedRevenue?: number | string | null;
  stage?: PipelineStage | string | null;
  stageId?: string;
  pipelineId?: string;
  customer?: { name?: string } | null;
  probability?: number | null;
};

export function PipelineView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [pipelineId, setPipelineId] = React.useState<string>("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [expectedRevenue, setExpectedRevenue] = React.useState("0");
  const [stageId, setStageId] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/pipelines");
      return unwrapList<Pipeline>(res.data);
    },
  });

  const pipelines = pipelinesQuery.data ?? [];
  const activePipeline =
    pipelines.find((p) => p.id === pipelineId) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0] ??
    null;

  React.useEffect(() => {
    if (!pipelineId && activePipeline?.id) {
      setPipelineId(activePipeline.id);
    }
  }, [pipelineId, activePipeline?.id]);

  const dealsQuery = useQuery({
    queryKey: ["deals", activePipeline?.id],
    enabled: !!activePipeline?.id,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activePipeline?.id) params.set("pipelineId", activePipeline.id);
      const res = await apiFetch<unknown>(`/api/deals?${params}`);
      return unwrapList<Deal>(res.data);
    },
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/customers?pageSize=100");
      return unwrapList<{ id: string; name: string }>(res.data);
    },
    enabled: createOpen,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) =>
      apiFetch(`/api/deals/${id}/move`, {
        method: "POST",
        body: JSON.stringify({ stageId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal moved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!activePipeline?.id) throw new Error("No pipeline selected");
      const stage =
        stageId || activePipeline.stages[0]?.id;
      if (!stage) throw new Error("No stage available");
      return apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          pipelineId: activePipeline.id,
          stageId: stage,
          customerId: customerId || null,
          expectedRevenue: Number(expectedRevenue) || 0,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Deal created");
      setCreateOpen(false);
      setTitle("");
      setExpectedRevenue("0");
      setStageId("");
      setCustomerId("");
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const stages = React.useMemo(
    () => activePipeline?.stages ?? [],
    [activePipeline?.stages],
  );
  const deals = React.useMemo(
    () => dealsQuery.data ?? [],
    [dealsQuery.data],
  );
  const stageIds = React.useMemo(
    () => new Set(stages.map((s) => s.id)),
    [stages],
  );

  const forecastByStage = React.useMemo(() => {
    function stageIdOf(deal: Deal): string {
      if (deal.stageId && stageIds.has(deal.stageId)) return deal.stageId;
      if (deal.stage && typeof deal.stage === "object" && deal.stage.id) {
        return deal.stage.id;
      }
      if (typeof deal.stage === "string") {
        const bySlug = stages.find(
          (s) => s.slug === deal.stage || s.name === deal.stage,
        );
        if (bySlug) return bySlug.id;
      }
      return stages[0]?.id ?? "";
    }

    return stages.map((stage) => {
      const stageDeals = deals.filter((d) => stageIdOf(d) === stage.id);
      const weighted = stageDeals.reduce((sum, d) => {
        const revenue = Number(d.expectedRevenue ?? d.value ?? 0);
        const prob =
          d.probability != null
            ? Number(d.probability)
            : stage.probability != null
              ? Number(stage.probability)
              : 0;
        return sum + revenue * (prob / 100);
      }, 0);
      const raw = stageDeals.reduce(
        (sum, d) => sum + Number(d.expectedRevenue ?? d.value ?? 0),
        0,
      );
      return {
        stageId: stage.id,
        name: stage.name,
        dealCount: stageDeals.length,
        raw,
        weighted,
      };
    });
  }, [stages, deals, stageIds]);

  const totalForecast = forecastByStage.reduce((s, r) => s + r.weighted, 0);
  const totalPipeline = forecastByStage.reduce((s, r) => s + r.raw, 0);

  function resolveStageId(deal: Deal): string {
    if (deal.stageId && stageIds.has(deal.stageId)) return deal.stageId;
    if (deal.stage && typeof deal.stage === "object" && deal.stage.id) {
      return deal.stage.id;
    }
    if (typeof deal.stage === "string") {
      const bySlug = stages.find(
        (s) => s.slug === deal.stage || s.name === deal.stage,
      );
      if (bySlug) return bySlug.id;
    }
    return stages[0]?.id ?? "unassigned";
  }

  const activeDeal = deals.find((d) => d.id === activeId) ?? null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = String(active.id);
    const overId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    const currentStageId = resolveStageId(deal);
    let nextStageId = overId;
    if (!stageIds.has(overId)) {
      const overDeal = deals.find((d) => d.id === overId);
      nextStageId = overDeal ? resolveStageId(overDeal) : currentStageId;
    }

    if (nextStageId && nextStageId !== currentStageId && stageIds.has(nextStageId)) {
      moveMutation.mutate({ id: dealId, stageId: nextStageId });
      queryClient.setQueryData<Deal[]>(
        ["deals", activePipeline?.id],
        (prev) =>
          (prev ?? []).map((d) =>
            d.id === dealId
              ? {
                  ...d,
                  stageId: nextStageId,
                  stage: stages.find((s) => s.id === nextStageId) ?? d.stage,
                }
              : d,
          ),
      );
    }
  }

  if (pipelinesQuery.isLoading || dealsQuery.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  if (pipelinesQuery.isError) {
    return (
      <EmptyState
        title="Pipeline unavailable"
        description={(pipelinesQuery.error as Error).message}
        action={
          <Button variant="outline" onClick={() => pipelinesQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!activePipeline || !stages.length) {
    return (
      <EmptyState
        title="No pipeline stages"
        description="Create a pipeline with stages via /api/pipelines."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {pipelines.length > 1 ? (
          <Select
            value={activePipeline.id}
            onValueChange={(v) => v && setPipelineId(v)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {can("deals:write") ? (
          <Button
            onClick={() => {
              setStageId(stages[0]?.id ?? "");
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            New deal
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Weighted forecast</p>
            <p className="text-lg font-semibold text-primary">
              {formatCurrency(totalForecast)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Σ expectedRevenue × probability
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pipeline value</p>
            <p className="text-lg font-semibold">{formatCurrency(totalPipeline)}</p>
            <p className="text-[11px] text-muted-foreground">
              {deals.length} open deals
            </p>
          </CardContent>
        </Card>
        {forecastByStage.slice(0, 2).map((row) => (
          <Card key={row.stageId} className="gap-0 py-0">
            <CardContent className="p-3">
              <p className="truncate text-xs text-muted-foreground">{row.name}</p>
              <p className="text-lg font-semibold">
                {formatCurrency(row.weighted)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {row.dealCount} deals · raw {formatCurrency(row.raw)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {dealsQuery.isError ? (
        <EmptyState
          title="Could not load deals"
          description={(dealsQuery.error as Error).message}
          action={
            <Button variant="outline" onClick={() => dealsQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const column = deals.filter((d) => resolveStageId(d) === stage.id);
              return (
                <StageColumn key={stage.id} stage={stage} deals={column} />
              );
            })}
          </div>
          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {!deals.length && !dealsQuery.isError ? (
        <EmptyState
          title="Pipeline is empty"
          description="Create a deal, then drag cards between stages."
          action={
            can("deals:write") ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New deal
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Create deal</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) {
                toast.error("Title is required");
                return;
              }
              createMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Expected revenue
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={expectedRevenue}
                onChange={(e) => setExpectedRevenue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stage</Label>
              <Select
                value={stageId || stages[0]?.id || ""}
                onValueChange={(v) => v && setStageId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Customer (optional)
              </Label>
              <Select
                value={customerId || "__none__"}
                onValueChange={(v) =>
                  setCustomerId(v === "__none__" ? "" : (v ?? ""))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {(customersQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageColumn({
  stage,
  deals,
}: {
  stage: PipelineStage;
  deals: Deal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-xl border bg-muted/30 ${
        isOver ? "border-primary/50" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold tracking-wide uppercase">
          {stage.name}
        </span>
        <Badge variant="outline">{deals.length}</Badge>
      </div>
      <SortableContext
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-24 space-y-2 p-2">
          {deals.map((deal) => (
            <SortableDeal key={deal.id} deal={deal} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableDeal({ deal }: { deal: Deal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard deal={deal} />
    </div>
  );
}

function DealCard({ deal, dragging }: { deal: Deal; dragging?: boolean }) {
  return (
    <Card
      className={`gap-0 py-0 ${dragging ? "shadow-lg ring-1 ring-primary/30" : ""}`}
    >
      <CardContent className="space-y-1 p-2.5">
        <p className="text-sm leading-snug font-medium">{deal.title}</p>
        <p className="text-xs text-muted-foreground">
          {deal.customer?.name ?? "No customer"}
        </p>
        <p className="text-xs font-semibold text-primary">
          {formatCurrency(deal.expectedRevenue ?? deal.value)}
        </p>
      </CardContent>
    </Card>
  );
}
