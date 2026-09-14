import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { getClientIp } from "@/server/api/rate-limit";
import { AppError, notFound, validationError } from "@/server/api/errors";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("users:manage");
    const { id } = await params;

    if (id === session.user.id) {
      throw validationError("You cannot delete your own account");
    }

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw notFound("User not found");

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

    // Soft-delete and free the email unique constraint so they can be re-invited.
    const deletedEmail = `deleted.${Date.now()}.${user.email}`;
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: deletedEmail,
        passwordHash: null,
      },
    });

    // Drop device push endpoints for the removed account.
    await prisma.webPushSubscription.deleteMany({ where: { userId: id } });

    await writeAuditLog({
      action: "USER_DELETE",
      entityType: "User",
      entityId: id,
      userId: session.user.id,
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
