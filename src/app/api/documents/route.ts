import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createDocument,
  createDocumentSchema,
  documentFiltersSchema,
  listDocuments,
} from "@/server/services/documents.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("documents:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = documentFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listDocuments(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("documents:write");
    const body = createDocumentSchema.parse(await request.json());
    const document = await createDocument(body, session.user.id);

    await writeAuditLog({
      action: "DOCUMENT_CREATE",
      entityType: "Document",
      entityId: document.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: document.name, category: document.category },
    });

    return created(document);
  } catch (error) {
    return fail(error);
  }
}
