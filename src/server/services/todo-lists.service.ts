import { type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "@/lib/validators/common";

export const createTodoListSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: emptyToNull,
  ownerId: optionalCuid,
});

export const updateTodoListSchema = createTodoListSchema.partial();

export const createTodoItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueDate: optionalDate,
  position: z.coerce.number().int().min(0).optional(),
  isDone: z.boolean().optional().default(false),
});

export const updateTodoItemSchema = createTodoItemSchema.partial();

export type CreateTodoListInput = z.infer<typeof createTodoListSchema>;
export type UpdateTodoListInput = z.infer<typeof updateTodoListSchema>;
export type CreateTodoItemInput = z.infer<typeof createTodoItemSchema>;
export type UpdateTodoItemInput = z.infer<typeof updateTodoItemSchema>;

const todoListInclude = {
  items: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  _count: { select: { items: true } },
} satisfies Prisma.TodoListInclude;

export async function listTodoLists(pagination: PaginationInput) {
  const where: Prisma.TodoListWhereInput = { deletedAt: null };
  if (pagination.q?.trim()) {
    const term = pagination.q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.todoList.count({ where }),
    prisma.todoList.findMany({
      where,
      include: todoListInclude,
      orderBy: { updatedAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getTodoListById(id: string) {
  const list = await prisma.todoList.findFirst({
    where: { id, deletedAt: null },
    include: todoListInclude,
  });
  if (!list) throw notFound("Todo list not found");
  return list;
}

export async function createTodoList(
  input: CreateTodoListInput,
  userId: string,
) {
  return prisma.todoList.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId: input.ownerId ?? userId,
    },
    include: todoListInclude,
  });
}

export async function updateTodoList(id: string, input: UpdateTodoListInput) {
  const existing = await prisma.todoList.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Todo list not found");

  return prisma.todoList.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description,
      ownerId: input.ownerId === undefined ? undefined : input.ownerId,
    },
    include: todoListInclude,
  });
}

export async function deleteTodoList(id: string) {
  const existing = await prisma.todoList.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Todo list not found");

  return prisma.todoList.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function addTodoItem(listId: string, input: CreateTodoItemInput) {
  const list = await prisma.todoList.findFirst({
    where: { id: listId, deletedAt: null },
  });
  if (!list) throw notFound("Todo list not found");

  const maxPos = await prisma.todoItem.aggregate({
    where: { todoListId: listId },
    _max: { position: true },
  });

  return prisma.todoItem.create({
    data: {
      todoListId: listId,
      title: input.title,
      dueDate: input.dueDate ?? undefined,
      isDone: input.isDone ?? false,
      position: input.position ?? (maxPos._max.position ?? -1) + 1,
    },
  });
}

export async function updateTodoItem(
  listId: string,
  itemId: string,
  input: UpdateTodoItemInput,
) {
  const item = await prisma.todoItem.findFirst({
    where: { id: itemId, todoListId: listId },
  });
  if (!item) throw notFound("Todo item not found");

  return prisma.todoItem.update({
    where: { id: itemId },
    data: {
      title: input.title,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate,
      isDone: input.isDone,
      position: input.position,
    },
  });
}

export async function deleteTodoItem(listId: string, itemId: string) {
  const item = await prisma.todoItem.findFirst({
    where: { id: itemId, todoListId: listId },
  });
  if (!item) throw notFound("Todo item not found");

  return prisma.todoItem.delete({ where: { id: itemId } });
}
