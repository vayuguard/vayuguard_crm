import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createTodoList,
  createTodoListSchema,
  listTodoLists,
} from "@/server/services/todo-lists.service";
import { getClientIp } from "@/server/api/rate-limit";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("tasks:read");
    const pagination = getPagination(request.nextUrl.searchParams);
    const { items, total } = await listTodoLists(pagination);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("tasks:write");
    const body = createTodoListSchema.parse(await request.json());
    const list = await createTodoList(body, session.user.id);

    await writeAuditLog({
      action: "TODO_LIST_CREATE",
      entityType: "TodoList",
      entityId: list.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: list.name },
    });

    return created(list);
  } catch (error) {
    return fail(error);
  }
}
