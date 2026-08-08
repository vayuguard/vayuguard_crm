import { auth } from "@/server/auth";
import { forbidden, unauthorized } from "@/server/api/errors";
import {
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw unauthorized();
  }
  return session;
}

export async function requirePermission(
  permission: PermissionKey | PermissionKey[],
) {
  const session = await requireSession();
  if (!hasPermission(session.user.permissions, permission)) {
    throw forbidden("You do not have permission to perform this action");
  }
  return session;
}

export async function getCurrentUserId() {
  const session = await requireSession();
  return session.user.id;
}
