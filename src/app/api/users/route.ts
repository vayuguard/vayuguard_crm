import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { RoleSlug } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { ok, created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { getClientIp, rateLimit } from "@/server/api/rate-limit";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { AppError, validationError } from "@/server/api/errors";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roleSlug: z.nativeEnum(RoleSlug),
  department: z.string().optional(),
  designation: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users:manage");
    const { searchParams } = new URL(request.url);
    const pagination = getPagination(searchParams);
    const where = {
      deletedAt: null,
      ...(pagination.q
        ? {
            OR: [
              { name: { contains: pagination.q, mode: "insensitive" as const } },
              { email: { contains: pagination.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: {
          role: true,
          employeeProfile: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
    ]);
    return ok(
      items.map(({ passwordHash: _, ...u }) => u),
      paginateMeta(total, pagination.page, pagination.pageSize),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("users:manage");
    const rl = rateLimit(`users:create:${session.user.id}`, 20, 60_000);
    if (!rl.success) throw new AppError("Too many requests", 429, "RATE_LIMITED");

    const body = createUserSchema.parse(await request.json());
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) throw validationError("Email already registered");

    const role = await prisma.role.findUnique({ where: { slug: body.roleSlug } });
    if (!role) throw validationError("Invalid role");

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
        roleId: role.id,
        employeeProfile: {
          create: {
            department: body.department,
            designation: body.designation,
          },
        },
      },
      include: { role: true, employeeProfile: true },
    });

    await writeAuditLog({
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { email: user.email, role: body.roleSlug },
    });

    const { passwordHash: _, ...safe } = user;
    return created(safe);
  } catch (error) {
    return fail(error);
  }
}
