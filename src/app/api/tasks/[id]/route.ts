import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteTask,
  getTaskById,
  updateTask,
  updateTaskSchema,
} from "@/server/services/tasks.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("tasks:read");
    const { id } = await params;
    return ok(await getTaskById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tasks:write");
    const { id } = await params;
    const body = updateTaskSchema.parse(await request.json());
    const task = await updateTask(id, body, session.user.id);

    await writeAuditLog({
      action: "TASK_UPDATE",
      entityType: "Task",
      entityId: task.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tasks:delete");
    const { id } = await params;
    const task = await deleteTask(id, session.user.id);

    await writeAuditLog({
      action: "TASK_DELETE",
      entityType: "Task",
      entityId: task.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { title: task.title },
    });

    return ok(task);
  } catch (error) {
    return fail(error);
  }
}
