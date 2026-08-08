import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { getQuotationPdfPayload } from "@/server/services/quotations.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("quotes:read");
    const { id } = await params;
    const payload = await getQuotationPdfPayload(id);
    const format = request.nextUrl.searchParams.get("format");

    if (format === "text") {
      return new Response(payload.textStub, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${payload.quoteNumber}.txt"`,
        },
      });
    }

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
