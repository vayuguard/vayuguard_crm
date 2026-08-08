import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteProduct,
  getProductById,
  updateProduct,
} from "@/server/services/products.service";
import { updateProductSchema } from "@/lib/validators/product";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("products:read");
    const { id } = await params;
    return ok(await getProductById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("products:write");
    const { id } = await params;
    const body = updateProductSchema.parse(await request.json());
    const product = await updateProduct(id, body, session.user.id);

    await writeAuditLog({
      action: "PRODUCT_UPDATE",
      entityType: "Product",
      entityId: product.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(product);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("products:write");
    const { id } = await params;
    const product = await deleteProduct(id, session.user.id);

    await writeAuditLog({
      action: "PRODUCT_DELETE",
      entityType: "Product",
      entityId: product.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { sku: product.sku },
    });

    return ok(product);
  } catch (error) {
    return fail(error);
  }
}
