import { type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "@/lib/validators/common";

export const upsertEmployeeProfileSchema = z.object({
  userId: cuidSchema,
  employeeCode: emptyToNull,
  department: emptyToNull,
  designation: emptyToNull,
  phone: emptyToNull,
  joiningDate: optionalDate,
  managerId: optionalCuid,
});

export const updateEmployeeProfileSchema = upsertEmployeeProfileSchema
  .omit({ userId: true })
  .partial();

export const createSalesTargetSchema = z.object({
  userId: cuidSchema,
  period: z.string().trim().min(1).max(40),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  targetAmount: z.coerce.number().finite().min(0),
  achievedAmount: z.coerce.number().finite().min(0).optional().default(0),
});

export const createAttendanceSchema = z.object({
  userId: cuidSchema,
  date: z.coerce.date(),
  checkIn: optionalDate,
  checkOut: optionalDate,
  status: z.string().trim().min(1).max(40).optional().default("present"),
  notes: emptyToNull,
});

export const createCommissionSchema = z.object({
  userId: cuidSchema,
  dealId: optionalCuid,
  amount: z.coerce.number().finite().min(0),
  rate: z.coerce.number().finite().min(0).max(100),
  period: emptyToNull,
  notes: emptyToNull,
});

export const employeeFiltersSchema = z.object({
  department: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type UpsertEmployeeProfileInput = z.infer<
  typeof upsertEmployeeProfileSchema
>;
export type UpdateEmployeeProfileInput = z.infer<
  typeof updateEmployeeProfileSchema
>;
export type CreateSalesTargetInput = z.infer<typeof createSalesTargetSchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type CreateCommissionInput = z.infer<typeof createCommissionSchema>;
export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>;

const employeeInclude = {
  role: { select: { id: true, name: true, slug: true } },
  employeeProfile: true,
  _count: {
    select: {
      assignedLeads: true,
      assignedDeals: true,
      commissions: true,
      salesTargets: true,
    },
  },
} satisfies Prisma.UserInclude;

function buildWhere(
  filters: EmployeeFilters,
  q?: string,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.department) {
    where.employeeProfile = {
      department: { contains: filters.department, mode: "insensitive" },
    };
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      {
        employeeProfile: {
          OR: [
            { employeeCode: { contains: term, mode: "insensitive" } },
            { department: { contains: term, mode: "insensitive" } },
            { designation: { contains: term, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  return where;
}

export async function listEmployees(
  pagination: PaginationInput,
  filters: EmployeeFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: employeeInclude,
      orderBy: { name: "asc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getEmployeeById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...employeeInclude,
      salesTargets: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 24 },
      attendanceRecords: { orderBy: { date: "desc" }, take: 60 },
      commissions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!user) throw notFound("Employee not found");
  return user;
}

export async function upsertEmployeeProfile(
  input: UpsertEmployeeProfileInput,
) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw notFound("User not found");

  if (input.employeeCode) {
    const dup = await prisma.employeeProfile.findFirst({
      where: {
        employeeCode: input.employeeCode,
        userId: { not: input.userId },
      },
    });
    if (dup) throw validationError("Employee code already in use");
  }

  return prisma.employeeProfile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      employeeCode: input.employeeCode,
      department: input.department,
      designation: input.designation,
      phone: input.phone,
      joiningDate: input.joiningDate,
      managerId: input.managerId,
    },
    update: {
      employeeCode: input.employeeCode,
      department: input.department,
      designation: input.designation,
      phone: input.phone,
      joiningDate: input.joiningDate,
      managerId: input.managerId,
    },
  });
}

export async function updateEmployeeProfile(
  userId: string,
  input: UpdateEmployeeProfileInput,
) {
  const existing = await prisma.employeeProfile.findUnique({
    where: { userId },
  });
  if (!existing) throw notFound("Employee profile not found");

  if (input.employeeCode && input.employeeCode !== existing.employeeCode) {
    const dup = await prisma.employeeProfile.findFirst({
      where: { employeeCode: input.employeeCode, userId: { not: userId } },
    });
    if (dup) throw validationError("Employee code already in use");
  }

  return prisma.employeeProfile.update({
    where: { userId },
    data: input,
  });
}

export async function createSalesTarget(input: CreateSalesTargetInput) {
  return prisma.salesTarget.create({
    data: {
      userId: input.userId,
      period: input.period,
      year: input.year,
      month: input.month ?? null,
      targetAmount: input.targetAmount,
      achievedAmount: input.achievedAmount ?? 0,
    },
  });
}

export async function recordAttendance(input: CreateAttendanceInput) {
  const date = new Date(input.date);
  date.setUTCHours(0, 0, 0, 0);

  return prisma.attendance.upsert({
    where: {
      userId_date: { userId: input.userId, date },
    },
    create: {
      userId: input.userId,
      date,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      status: input.status ?? "present",
      notes: input.notes,
    },
    update: {
      checkIn: input.checkIn === undefined ? undefined : input.checkIn,
      checkOut: input.checkOut === undefined ? undefined : input.checkOut,
      status: input.status,
      notes: input.notes === undefined ? undefined : input.notes,
    },
  });
}

export async function createCommission(input: CreateCommissionInput) {
  return prisma.commission.create({
    data: {
      userId: input.userId,
      dealId: input.dealId,
      amount: input.amount,
      rate: input.rate,
      period: input.period,
      notes: input.notes,
    },
  });
}

export async function getEmployeeLeaderboard(options: {
  year?: number;
  month?: number;
  limit?: number;
} = {}) {
  const year = options.year ?? new Date().getFullYear();
  const limit = options.limit ?? 20;

  const targets = await prisma.salesTarget.findMany({
    where: {
      year,
      ...(options.month ? { month: options.month } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          employeeProfile: {
            select: { department: true, designation: true, employeeCode: true },
          },
        },
      },
    },
  });

  const commissions = await prisma.commission.groupBy({
    by: ["userId"],
    _sum: { amount: true },
    where: {
      userId: { in: targets.map((t) => t.userId) },
    },
  });
  const commissionMap = new Map(
    commissions.map((c) => [c.userId, Number(c._sum.amount ?? 0)]),
  );

  const byUser = new Map<
    string,
    {
      userId: string;
      user: (typeof targets)[number]["user"];
      targetAmount: number;
      achievedAmount: number;
      commissionAmount: number;
      achievementPercent: number;
    }
  >();

  for (const t of targets) {
    const prev = byUser.get(t.userId);
    const targetAmount =
      (prev?.targetAmount ?? 0) + Number(t.targetAmount);
    const achievedAmount =
      (prev?.achievedAmount ?? 0) + Number(t.achievedAmount);
    byUser.set(t.userId, {
      userId: t.userId,
      user: t.user,
      targetAmount,
      achievedAmount,
      commissionAmount: commissionMap.get(t.userId) ?? 0,
      achievementPercent:
        targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0,
    });
  }

  return [...byUser.values()]
    .sort((a, b) => b.achievedAmount - a.achievedAmount)
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}
