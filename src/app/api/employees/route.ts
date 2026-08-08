import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createAttendanceSchema,
  createCommissionSchema,
  createSalesTargetSchema,
  employeeFiltersSchema,
  listEmployees,
  recordAttendance,
  createCommission,
  createSalesTarget,
  upsertEmployeeProfile,
  upsertEmployeeProfileSchema,
} from "@/server/services/employees.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";
import { z } from "zod";

const createEmployeeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    data: upsertEmployeeProfileSchema,
  }),
  z.object({
    action: z.literal("target"),
    data: createSalesTargetSchema,
  }),
  z.object({
    action: z.literal("attendance"),
    data: createAttendanceSchema,
  }),
  z.object({
    action: z.literal("commission"),
    data: createCommissionSchema,
  }),
]);

export async function GET(request: NextRequest) {
  try {
    await requirePermission("employees:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = employeeFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listEmployees(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("employees:write");
    const body = createEmployeeActionSchema.parse(await request.json());

    let result;
    switch (body.action) {
      case "profile":
        result = await upsertEmployeeProfile(body.data);
        break;
      case "target":
        result = await createSalesTarget(body.data);
        break;
      case "attendance":
        result = await recordAttendance(body.data);
        break;
      case "commission":
        result = await createCommission(body.data);
        break;
    }

    await writeAuditLog({
      action: `EMPLOYEE_${body.action.toUpperCase()}`,
      entityType: "Employee",
      entityId: body.data.userId,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return created(result);
  } catch (error) {
    return fail(error);
  }
}
