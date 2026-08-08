import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  getEmployeeById,
  updateEmployeeProfile,
  updateEmployeeProfileSchema,
} from "@/server/services/employees.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("employees:read");
    const { id } = await params;
    return ok(await getEmployeeById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("employees:write");
    const { id } = await params;
    const body = updateEmployeeProfileSchema.parse(await request.json());
    const profile = await updateEmployeeProfile(id, body);

    await writeAuditLog({
      action: "EMPLOYEE_PROFILE_UPDATE",
      entityType: "EmployeeProfile",
      entityId: profile.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(await getEmployeeById(id));
  } catch (error) {
    return fail(error);
  }
}
