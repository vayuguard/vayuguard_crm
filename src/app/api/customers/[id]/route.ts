import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteCustomer,
  getCustomerById,
  updateCustomer,
  updateCustomerSchema,
} from "@/server/services/customers.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("customers:read");
    const { id } = await params;
    return ok(await getCustomerById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("customers:write");
    const { id } = await params;
    const body = updateCustomerSchema.parse(await request.json());
    const customer = await updateCustomer(id, body, session.user.id);

    await writeAuditLog({
      action: "CUSTOMER_UPDATE",
      entityType: "Customer",
      entityId: customer.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(customer);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("customers:delete");
    const { id } = await params;
    const customer = await deleteCustomer(id, session.user.id);

    await writeAuditLog({
      action: "CUSTOMER_DELETE",
      entityType: "Customer",
      entityId: customer.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { customerNumber: customer.customerNumber },
    });

    return ok(customer);
  } catch (error) {
    return fail(error);
  }
}
