import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { convertContactToCustomer } from "@/server/services/contacts.service";
import { getClientIp } from "@/server/api/rate-limit";
import { emptyToNull } from "@/lib/validators/common";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    companyName: emptyToNull,
  })
  .optional()
  .default({});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission([
      "contacts:write",
      "customers:write",
    ]);
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const options = bodySchema.parse(json);
    const result = await convertContactToCustomer(
      id,
      session.user.id,
      options,
    );

    await writeAuditLog({
      action: "CONTACT_TO_CUSTOMER",
      entityType: "Contact",
      entityId: id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { customerId: result.customer.id },
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
