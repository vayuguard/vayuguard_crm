import { Priority, TaskStatus, TaskType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "@/lib/validators/common";

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: emptyToNull,
  type: z.nativeEnum(TaskType).optional().default(TaskType.TASK),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.TODO),
  priority: z.nativeEnum(Priority).optional().default(Priority.MEDIUM),
  dueAt: optionalDate,
  assignedToId: optionalCuid,
  leadId: optionalCuid,
  customerId: optionalCuid,
  recurrence: z
    .object({
      pattern: z.string().min(1),
      interval: z.coerce.number().int().min(1).default(1),
      until: optionalDate,
    })
    .optional()
    .nullable(),
  reminderAt: optionalDate,
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskFiltersSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assignedToId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, name: true, leadNumber: true } },
  customer: { select: { id: true, name: true, customerNumber: true } },
  recurrence: true,
  reminders: true,
} satisfies Prisma.TaskInclude;

function buildWhere(
  filters: TaskFilters,
  q?: string,
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.dueFrom || filters.dueTo) {
    where.dueAt = {};
    if (filters.dueFrom) where.dueAt.gte = filters.dueFrom;
    if (filters.dueTo) where.dueAt.lte = filters.dueTo;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listTasks(
  pagination: PaginationInput,
  filters: TaskFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: {
        [pagination.sort &&
        ["dueAt", "createdAt", "priority", "status", "title"].includes(
          pagination.sort,
        )
          ? pagination.sort
          : "dueAt"]: pagination.order,
      },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getTaskById(id: string) {
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: taskInclude,
  });
  if (!task) throw notFound("Task not found");
  return task;
}

export async function createTask(input: CreateTaskInput, userId: string) {
  const { recurrence, reminderAt, ...data } = input;

  return prisma.task.create({
    data: {
      ...data,
      completedAt: data.status === TaskStatus.DONE ? new Date() : null,
      createdById: userId,
      updatedById: userId,
      recurrence: recurrence
        ? {
            create: {
              pattern: recurrence.pattern,
              interval: recurrence.interval,
              until: recurrence.until ?? undefined,
            },
          }
        : undefined,
      reminders: reminderAt
        ? {
            create: {
              title: `Reminder: ${data.title}`,
              remindAt: reminderAt,
              userId: data.assignedToId ?? userId,
            },
          }
        : undefined,
    },
    include: taskInclude,
  });
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  userId: string,
) {
  const existing = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: { recurrence: true },
  });
  if (!existing) throw notFound("Task not found");

  const { recurrence, reminderAt, ...data } = input;

  return prisma.$transaction(async (tx) => {
    if (recurrence === null && existing.recurrence) {
      await tx.taskRecurrence.delete({ where: { taskId: id } });
    } else if (recurrence) {
      await tx.taskRecurrence.upsert({
        where: { taskId: id },
        create: {
          taskId: id,
          pattern: recurrence.pattern,
          interval: recurrence.interval,
          until: recurrence.until ?? undefined,
        },
        update: {
          pattern: recurrence.pattern,
          interval: recurrence.interval,
          until: recurrence.until ?? undefined,
        },
      });
    }

    if (reminderAt) {
      await tx.reminder.create({
        data: {
          title: `Reminder: ${data.title ?? existing.title}`,
          remindAt: reminderAt,
          taskId: id,
          userId: data.assignedToId ?? existing.assignedToId ?? userId,
        },
      });
    }

    const nextStatus = data.status ?? existing.status;
    return tx.task.update({
      where: { id },
      data: {
        ...data,
        completedAt:
          nextStatus === TaskStatus.DONE
            ? existing.completedAt ?? new Date()
            : nextStatus
              ? null
              : undefined,
        updatedById: userId,
      },
      include: taskInclude,
    });
  });
}

export async function deleteTask(id: string, userId: string) {
  const existing = await prisma.task.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Task not found");

  return prisma.task.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });
}
