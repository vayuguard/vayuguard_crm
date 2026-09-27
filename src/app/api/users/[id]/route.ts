import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { getClientIp } from "@/server/api/rate-limit";
import { AppError, notFound, validationError } from "@/server/api/errors";

type Params = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("users:manage");
    const { id } = await params;
    if (!id) throw validationError("User id is required");

    const body = updateUserSchema.parse(await request.json());

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw notFound("User not found");

    const previousName = user.name;
    const updated = await prisma.user.update({
      where: { id },
      data: { name: body.name },
      include: { role: true, employeeProfile: true },
    });

    await writeAuditLog({
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        email: updated.email,
        previousName,
        name: updated.name,
        self: id === session.user.id,
      },
    });

    const { passwordHash: hash, ...safe } = updated;
    void hash;
    return ok(safe);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("users:manage");
    const { id } = await params;
    const actorId = session.user.id;
    const actorEmail = session.user.email?.toLowerCase() ?? null;

    if (!id) throw validationError("User id is required");

    // Never allow the signed-in admin to remove their own login.
    if (id === actorId) {
      throw validationError("You cannot delete your own account");
    }

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw notFound("User not found");

    if (actorEmail && user.email.toLowerCase() === actorEmail) {
      throw validationError("You cannot delete your own account");
    }

    // Keep at least one Super Admin able to sign in.
    if (user.role.slug === "SUPER_ADMIN") {
      const remaining = await prisma.user.count({
        where: {
          deletedAt: null,
          id: { not: id },
          role: { slug: "SUPER_ADMIN" },
        },
      });
      if (remaining < 1) {
        throw new AppError(
          "Cannot delete the last Super Admin",
          422,
          "VALIDATION_ERROR",
        );
      }
    }

    // Soft-delete only the target account. The admin session is untouched.
    const deletedEmail = `deleted.${Date.now()}.${user.email}`;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          email: deletedEmail,
          passwordHash: null,
        },
      });

      // Drop DB sessions for the deleted user only (JWT users are blocked on
      // the next token refresh via the auth jwt callback).
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.account.deleteMany({ where: { userId: id } });

      try {
        await tx.webPushSubscription.deleteMany({ where: { userId: id } });
      } catch {
        // Table may not exist yet on older deployments — ignore.
      }
    });

    await writeAuditLog({
      action: "USER_DELETE",
      entityType: "User",
      entityId: id,
      userId: actorId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        email: user.email,
        name: user.name,
        role: user.role.slug,
      },
    });

    return ok({ id, deleted: true });
  } catch (error) {
    return fail(error);
  }
}
