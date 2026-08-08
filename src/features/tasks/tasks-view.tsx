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
import {
  CheckSquare,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const TASK_TYPES = ["TASK", "CALL", "MEETING", "REMINDER", "FOLLOW_UP"] as const;
const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const RECURRENCE_PATTERNS = ["daily", "weekly", "monthly", "yearly"] as const;

type Task = {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  dueAt?: string | null;
  dueDate?: string | null;
  type?: string | null;
  assignedTo?: { name?: string } | null;
  recurrence?: {
    pattern?: string;
    interval?: number;
    until?: string | null;
  } | null;
};

type TaskFormValues = {
  title: string;
  type: (typeof TASK_TYPES)[number];
  status: (typeof TASK_STATUSES)[number];
  priority: (typeof TASK_PRIORITIES)[number];
  dueAt: string;
  recurrenceEnabled: boolean;
  recurrencePattern: (typeof RECURRENCE_PATTERNS)[number];
  recurrenceInterval: number;
  recurrenceUntil: string;
};

type TodoItem = {
  id: string;
  title: string;
  isDone: boolean;
  dueDate?: string | null;
};

type TodoList = {
  id: string;
  name: string;
  description?: string | null;
  items?: TodoItem[];
  _count?: { items?: number };
};

const emptyForm: TaskFormValues = {
  title: "",
  type: "TASK",
  status: "TODO",
  priority: "MEDIUM",
  dueAt: "",
  recurrenceEnabled: false,
  recurrencePattern: "weekly",
  recurrenceInterval: 1,
  recurrenceUntil: "",
};

type ViewMode = "table" | "kanban";

export function TasksView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [tab, setTab] = React.useState("tasks");
  const [view, setView] = React.useState<ViewMode>("table");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [deleting, setDeleting] = React.useState<Task | null>(null);
  const [form, setForm] = React.useState<TaskFormValues>(emptyForm);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["tasks", debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      params.set("pageSize", "100");
      const url = `/api/tasks?${params}`;
      const res = await apiFetch<unknown>(url);
      return unwrapList<Task>(res.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const payload: Record<string, unknown> = {
        title: values.title,
        type: values.type,
        status: values.status,
        priority: values.priority,
        dueAt: values.dueAt || null,
        recurrence: values.recurrenceEnabled
          ? {
              pattern: values.recurrencePattern,
              interval: values.recurrenceInterval,
              until: values.recurrenceUntil || null,
            }
          : editing
            ? null
            : undefined,
      };
      if (editing) {
        return apiFetch(`/api/tasks/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Task updated" : "Task created");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const tasks = query.data ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      type: (task.type as TaskFormValues["type"]) || "TASK",
      status: (task.status as TaskFormValues["status"]) || "TODO",
      priority: (task.priority as TaskFormValues["priority"]) || "MEDIUM",
      dueAt: task.dueAt
        ? new Date(task.dueAt).toISOString().slice(0, 16)
        : "",
      recurrenceEnabled: !!task.recurrence,
      recurrencePattern:
        (task.recurrence?.pattern as TaskFormValues["recurrencePattern"]) ||
        "weekly",
      recurrenceInterval: task.recurrence?.interval ?? 1,
      recurrenceUntil: task.recurrence?.until
        ? new Date(task.recurrence.until).toISOString().slice(0, 10)
        : "",
    });
    setDialogOpen(true);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    let nextStatus = overId;
    if (!(TASK_STATUSES as readonly string[]).includes(overId)) {
      const overTask = tasks.find((t) => t.id === overId);
      nextStatus = overTask?.status ?? task.status ?? "TODO";
    }
    if (nextStatus !== task.status) {
      moveMutation.mutate({ id: taskId, status: nextStatus });
      queryClient.setQueryData<Task[]>(["tasks", debounced], (prev) =>
        (prev ?? []).map((t) =>
          t.id === taskId ? { ...t, status: nextStatus } : t,
        ),
      );
    }
  }

  const columns: DataTableColumn<Task>[] = [
    {
      id: "title",
      header: "Task",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted-foreground">{r.type ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status ? <Badge variant="secondary">{r.status}</Badge> : "—",
    },
    {
      id: "priority",
      header: "Priority",
      cell: (r) => r.priority ?? "—",
    },
    {
      id: "assignee",
      header: "Assignee",
      cell: (r) => r.assignedTo?.name ?? "—",
    },
    {
      id: "due",
      header: "Due",
      cell: (r) => formatDate(r.dueAt ?? r.dueDate),
    },
    {
      id: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {can("tasks:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(r);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {can("tasks:delete") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(r);
              }}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="todos">Todo lists</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="max-w-xs"
            />
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                >
                  <List className="size-3.5" />
                  Table
                </Button>
                <Button
                  variant={view === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("kanban")}
                >
                  <LayoutGrid className="size-3.5" />
                  Kanban
                </Button>
              </div>
              {can("tasks:write") ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  New task
                </Button>
              ) : null}
            </div>
          </div>

          {query.isLoading ? (
            <LoadingSkeleton rows={6} />
          ) : query.isError ? (
            <EmptyState
              title="Failed to load tasks"
              description={(query.error as Error).message}
              action={
                <Button variant="outline" onClick={() => query.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : view === "table" ? (
            <DataTable
              columns={columns}
              data={tasks}
              getRowId={(r) => r.id}
              emptyTitle="No tasks"
              emptyDescription="Create tasks to track follow-ups and work items."
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(e: DragStartEvent) =>
                setActiveId(String(e.active.id))
              }
              onDragEnd={onDragEnd}
            >
              <div className="flex gap-3 overflow-x-auto pb-2">
                {TASK_STATUSES.map((status) => (
                  <TaskColumn
                    key={status}
                    status={status}
                    tasks={tasks.filter((t) => t.status === status)}
                    canWrite={can("tasks:write")}
                    onEdit={openEdit}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTask ? (
                  <TaskCard task={activeTask} dragging />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="todos" className="mt-4">
          <TodoListsSection canWrite={can("tasks:write")} />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "Create task"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) {
                toast.error("Title is required");
                return;
              }
              saveMutation.mutate(form);
            }}
          >
            <Field label="Title *">
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      type: (v as TaskFormValues["type"]) ?? "TASK",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
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
                      status: (v as TaskFormValues["status"]) ?? "TODO",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: (v as TaskFormValues["priority"]) ?? "MEDIUM",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Due at">
                <Input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueAt: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.recurrenceEnabled}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, recurrenceEnabled: !!v }))
                  }
                />
                Recurring task
              </label>
              {form.recurrenceEnabled ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Pattern">
                    <Select
                      value={form.recurrencePattern}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          recurrencePattern:
                            (v as TaskFormValues["recurrencePattern"]) ??
                            "weekly",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_PATTERNS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Interval">
                    <Input
                      type="number"
                      min={1}
                      value={form.recurrenceInterval}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          recurrenceInterval: Number(e.target.value) || 1,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Until">
                    <Input
                      type="date"
                      value={form.recurrenceUntil}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          recurrenceUntil: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? "Saving…"
                  : editing
                    ? "Save"
                    : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete task?"
        description={`This will remove “${deleting?.title ?? ""}”.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  canWrite,
  onEdit,
}: {
  status: string;
  tasks: Task[];
  canWrite: boolean;
  onEdit: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-xl border bg-muted/30",
        isOver ? "border-primary/50" : "border-border",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold tracking-wide uppercase">
          {status.replace("_", " ")}
        </span>
        <Badge variant="outline">{tasks.length}</Badge>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-24 space-y-2 p-2">
          {tasks.map((task) => (
            <SortableTask
              key={task.id}
              task={task}
              canWrite={canWrite}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTask({
  task,
  canWrite,
  onEdit,
}: {
  task: Task;
  canWrite: boolean;
  onEdit: (t: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={canWrite ? () => onEdit(task) : undefined} />
    </div>
  );
}

function TaskCard({
  task,
  dragging,
  onEdit,
}: {
  task: Task;
  dragging?: boolean;
  onEdit?: () => void;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-0",
        dragging && "shadow-lg ring-1 ring-primary/30",
      )}
    >
      <CardContent className="space-y-1 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug font-medium">{task.title}</p>
          {onEdit ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onEdit}
            >
              <Pencil className="size-3" />
            </button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {task.type ?? "TASK"} · {task.priority ?? "MEDIUM"}
        </p>
        {task.dueAt || task.dueDate ? (
          <p className="text-xs text-muted-foreground">
            {formatDate(task.dueAt ?? task.dueDate)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TodoListsSection({ canWrite }: { canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [itemDrafts, setItemDrafts] = React.useState<Record<string, string>>(
    {},
  );

  const query = useQuery({
    queryKey: ["todo-lists"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/todo-lists");
      return unwrapList<TodoList>(res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/todo-lists", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null }),
      }),
    onSuccess: () => {
      toast.success("Todo list created");
      setDialogOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ listId, title }: { listId: string; title: string }) =>
      apiFetch(`/api/todo-lists/${listId}`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    onSuccess: (_data, vars) => {
      setItemDrafts((d) => ({ ...d, [vars.listId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({
      listId,
      itemId,
      isDone,
    }: {
      listId: string;
      itemId: string;
      isDone: boolean;
    }) =>
      apiFetch(`/api/todo-lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ itemId, isDone }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/todo-lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("List deleted");
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (query.isLoading) return <LoadingSkeleton rows={4} />;
  if (query.isError) {
    return (
      <EmptyState
        title="Failed to load todo lists"
        description={(query.error as Error).message}
      />
    );
  }

  const lists = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New list
          </Button>
        ) : null}
      </div>

      {lists.length === 0 ? (
        <EmptyState
          title="No todo lists"
          description="Create a checklist for personal or team work."
          action={
            canWrite ? (
              <Button onClick={() => setDialogOpen(true)}>
                <CheckSquare className="size-4" />
                Create list
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => (
            <Card key={list.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{list.name}</p>
                    {list.description ? (
                      <p className="text-xs text-muted-foreground">
                        {list.description}
                      </p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteListMutation.mutate(list.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
                <ul className="space-y-2">
                  {(list.items ?? []).map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={item.isDone}
                        disabled={!canWrite}
                        onCheckedChange={(v) =>
                          toggleItemMutation.mutate({
                            listId: list.id,
                            itemId: item.id,
                            isDone: !!v,
                          })
                        }
                      />
                      <span
                        className={cn(
                          item.isDone && "text-muted-foreground line-through",
                        )}
                      >
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
                {canWrite ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const title = (itemDrafts[list.id] ?? "").trim();
                      if (!title) return;
                      addItemMutation.mutate({ listId: list.id, title });
                    }}
                  >
                    <Input
                      value={itemDrafts[list.id] ?? ""}
                      onChange={(e) =>
                        setItemDrafts((d) => ({
                          ...d,
                          [list.id]: e.target.value,
                        }))
                      }
                      placeholder="Add item…"
                      className="h-8"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Add
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New todo list</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error("Name is required");
                return;
              }
              createMutation.mutate();
            }}
          >
            <Field label="Name *">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
