import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  addTodoItem,
  createTodoItemSchema,
  deleteTodoItem,
  deleteTodoList,
  getTodoListById,
  updateTodoItem,
  updateTodoItemSchema,
  updateTodoList,
  updateTodoListSchema,
} from "@/server/services/todo-lists.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("tasks:read");
    const { id } = await params;
    return ok(await getTodoListById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tasks:write");
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    // Nested item update: { itemId, ...fields } or { item: { id, ... } }
    if (typeof body.itemId === "string") {
      const itemId = body.itemId;
      const { itemId: _omit, delete: shouldDelete, ...rest } = body;
      if (shouldDelete === true) {
        const deleted = await deleteTodoItem(id, itemId);
        await writeAuditLog({
          action: "TODO_ITEM_DELETE",
          entityType: "TodoItem",
          entityId: itemId,
          userId: session.user.id,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        });
        return ok(deleted);
      }
      const parsed = updateTodoItemSchema.parse(rest);
      const item = await updateTodoItem(id, itemId, parsed);
      return ok(item);
    }

    const parsed = updateTodoListSchema.parse(body);
    const list = await updateTodoList(id, parsed);

    await writeAuditLog({
      action: "TODO_LIST_UPDATE",
      entityType: "TodoList",
      entityId: list.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: parsed,
    });

    return ok(list);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tasks:write");
    const { id } = await params;
    const body = createTodoItemSchema.parse(await request.json());
    const item = await addTodoItem(id, body);

    await writeAuditLog({
      action: "TODO_ITEM_CREATE",
      entityType: "TodoItem",
      entityId: item.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { todoListId: id, title: item.title },
    });

    return created(item);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tasks:delete");
    const { id } = await params;
    const list = await deleteTodoList(id);

    await writeAuditLog({
      action: "TODO_LIST_DELETE",
      entityType: "TodoList",
      entityId: list.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: list.name },
    });

    return ok(list);
  } catch (error) {
    return fail(error);
  }
}
