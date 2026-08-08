import { NextRequest } from "next/server";
import { created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { recordPayment } from "@/server/services/invoices.service";
import { createPaymentSchema } from "@/lib/validators/invoice";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("invoices:write");
    const { id } = await params;
    const body = createPaymentSchema.parse(await request.json());
    const result = await recordPayment(id, body, session.user.id);

    await writeAuditLog({
      action: "PAYMENT_CREATE",
      entityType: "Payment",
      entityId: result.payment.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        invoiceId: id,
        paymentNumber: result.payment.paymentNumber,
        amount: body.amount,
      },
    });

    return created(result);
  } catch (error) {
    return fail(error);
  }
}
