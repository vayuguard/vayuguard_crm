import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { getInvoicePdfPayload } from "@/server/services/invoices.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("invoices:read");
    const { id } = await params;
    const payload = await getInvoicePdfPayload(id);
    const format = request.nextUrl.searchParams.get("format");

    if (format === "text") {
      return new Response(payload.textStub, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${payload.invoiceNumber}.txt"`,
        },
      });
    }

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
