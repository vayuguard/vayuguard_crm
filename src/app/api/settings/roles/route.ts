import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  listRolesWithPermissions,
  updateRolePermissions,
  updateRolePermissionsSchema,
} from "@/server/services/settings.service";
import { getClientIp } from "@/server/api/rate-limit";

export async function GET() {
  try {
    await requirePermission("settings:read");
    return ok(await listRolesWithPermissions());
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission("settings:write");
    const body = updateRolePermissionsSchema.parse(await request.json());
    const result = await updateRolePermissions(body);

    await writeAuditLog({
      action: "ROLE_PERMISSIONS_UPDATE",
      entityType: "Role",
      entityId: body.roleId,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { permissionKeys: body.permissionKeys },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
