"use client";

import { useSession } from "next-auth/react";
import {
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions";

export function usePermissions() {
  const { data: session, status } = useSession();
  const permissions = session?.user?.permissions ?? [];

  return {
    permissions,
    role: session?.user?.role,
    user: session?.user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    can: (required: PermissionKey | PermissionKey[]) =>
      hasPermission(permissions, required),
    canAny: (required: PermissionKey[]) => {
      if (!permissions.length) return false;
      if (permissions.includes("*")) return true;
      return required.some((p) => permissions.includes(p));
    },
  };
}
