import type { DefaultSession } from "next-auth";
import type { RoleSlug } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: RoleSlug;
      roleId: string;
      permissions: string[];
    };
  }

  interface User {
    role?: RoleSlug;
    roleId?: string;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: RoleSlug;
    roleId?: string;
    permissions?: string[];
  }
}
