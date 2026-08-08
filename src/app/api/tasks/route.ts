import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createTask,
  createTaskSchema,
  listTasks,
  taskFiltersSchema,
} from "@/server/services/tasks.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("tasks:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = taskFiltersSchema.parse(searchParamsObject(searchParams));
    const { items, total } = await listTasks(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("tasks:write");
    const body = createTaskSchema.parse(await request.json());
    const task = await createTask(body, session.user.id);

    await writeAuditLog({
      action: "TASK_CREATE",
      entityType: "Task",
      entityId: task.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { title: task.title, type: task.type },
    });

    return created(task);
  } catch (error) {
    return fail(error);
  }
}
