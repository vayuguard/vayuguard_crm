import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createProduct,
  listProducts,
} from "@/server/services/products.service";
import {
  createProductSchema,
  productFiltersSchema,
} from "@/lib/validators/product";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("products:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = productFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listProducts(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("products:write");
    const body = createProductSchema.parse(await request.json());
    const product = await createProduct(body, session.user.id);

    await writeAuditLog({
      action: "PRODUCT_CREATE",
      entityType: "Product",
      entityId: product.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { sku: product.sku },
    });

    return created(product);
  } catch (error) {
    return fail(error);
  }
}
