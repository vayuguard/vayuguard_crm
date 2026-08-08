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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: RoleSlug }).role;
        token.roleId = (user as { roleId?: string }).roleId;
        token.permissions = (user as { permissions?: string[] }).permissions ?? [];
      }

      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { role: true },
        });
        if (dbUser) {
          token.role = dbUser.role.slug;
          token.roleId = dbUser.roleId;
          token.permissions = await getUserPermissions(
            dbUser.roleId,
            dbUser.role.slug,
          );
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
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
