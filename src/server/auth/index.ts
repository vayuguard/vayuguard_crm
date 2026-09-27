import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";
import type { RoleSlug } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function getUserPermissions(roleId: string, slug: RoleSlug) {
  if (slug === "SUPER_ADMIN" || slug === "ADMIN") {
    return ["*", ...ALL_PERMISSION_KEYS];
  }

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  return rows.map((r) => r.permission.key);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findFirst({
          where: {
            email: parsed.data.email.toLowerCase(),
            deletedAt: null,
            isActive: true,
          },
          include: { role: true },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        const permissions = await getUserPermissions(user.roleId, user.role.slug);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role.slug,
          roleId: user.roleId,
          permissions,
        };
      },
    }),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: RoleSlug }).role;
        token.roleId = (user as { roleId?: string }).roleId;
        token.permissions =
          (user as { permissions?: string[] }).permissions ?? [];
        (token as { lastCheckedAt?: number }).lastCheckedAt = Date.now();
      }

      // Immediate client-driven session updates (e.g. rename self).
      if (trigger === "update" && session && typeof session === "object") {
        const patch = session as { name?: string };
        if (typeof patch.name === "string" && patch.name.trim().length >= 2) {
          token.name = patch.name.trim();
        }
      }

      const userId = (token.id ?? token.sub) as string | undefined;
      if (!userId) return token;

      // Always keep token.id in sync so session.user.id is reliable for guards.
      token.id = userId;

      // On every request: if Super Admin deleted this account, kill this JWT
      // immediately so that user is logged out on their next page/API hit.
      try {
        const account = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            email: true,
            deletedAt: true,
            isActive: true,
            roleId: true,
            role: { select: { slug: true } },
          },
        });

        if (!account || account.deletedAt || !account.isActive) {
          return {
            ...token,
            id: undefined,
            sub: undefined,
            role: undefined,
            roleId: undefined,
            permissions: [],
            error: "AccountDisabled",
            exp: Math.floor(Date.now() / 1000) - 30,
          };
        }

        // Keep display name in sync (e.g. after Super Admin renames anyone,
        // including themselves).
        token.name = account.name ?? token.name;
        if (account.email) token.email = account.email;

        // Refresh role permissions when asked, or about once a minute.
        const shouldRefreshPermissions =
          trigger === "update" ||
          !token.permissions ||
          (token as { lastCheckedAt?: number }).lastCheckedAt == null ||
          Date.now() -
            Number((token as { lastCheckedAt?: number }).lastCheckedAt) >
            60_000;

        if (shouldRefreshPermissions) {
          token.role = account.role.slug;
          token.roleId = account.roleId;
          token.permissions = await getUserPermissions(
            account.roleId,
            account.role.slug,
          );
          (token as { lastCheckedAt?: number }).lastCheckedAt = Date.now();
        }
      } catch {
        // Keep the existing token on transient DB errors.
      }

      return token;
    },
    async session({ session, token }) {
      if (
        (token as { error?: string }).error === "AccountDisabled" ||
        !token.id
      ) {
        // Deleted/disabled account → treated as signed out.
        return {
          ...session,
          user: {
            ...session.user,
            id: "",
            email: null,
            name: null,
            image: null,
            role: undefined as never,
            roleId: "",
            permissions: [],
          },
        };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = (token.name as string | null | undefined) ?? session.user.name;
        session.user.email =
          (token.email as string | null | undefined) ?? session.user.email;
        session.user.role = token.role as RoleSlug;
        session.user.roleId = token.roleId as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      await prisma.auditLog.create({
        data: {
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
          userId: user.id,
          metadata: { email: user.email },
        },
      });
    },
  },
  trustHost: true,
});
