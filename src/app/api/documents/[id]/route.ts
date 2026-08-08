import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteDocument,
  getDocumentById,
  updateDocument,
  updateDocumentSchema,
} from "@/server/services/documents.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("documents:read");
    const { id } = await params;
    return ok(await getDocumentById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("documents:write");
    const { id } = await params;
    const body = updateDocumentSchema.parse(await request.json());
    const document = await updateDocument(id, body, session.user.id);

    await writeAuditLog({
      action: "DOCUMENT_UPDATE",
      entityType: "Document",
      entityId: document.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(document);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("documents:write");
    const { id } = await params;
    const document = await deleteDocument(id);

    await writeAuditLog({
      action: "DOCUMENT_DELETE",
      entityType: "Document",
      entityId: document.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: document.name },
    });

    return ok(document);
  } catch (error) {
    return fail(error);
  }
}
