import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createCustomer,
  createCustomerSchema,
  customerFiltersSchema,
  listCustomers,
} from "@/server/services/customers.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("customers:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = customerFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listCustomers(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("customers:write");
    const body = createCustomerSchema.parse(await request.json());
    const customer = await createCustomer(body, session.user.id);

    await writeAuditLog({
      action: "CUSTOMER_CREATE",
      entityType: "Customer",
      entityId: customer.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { customerNumber: customer.customerNumber },
    });

    return created(customer);
  } catch (error) {
    return fail(error);
  }
}
