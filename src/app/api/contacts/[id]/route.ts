import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteContact,
  getContactById,
  updateContact,
  updateContactSchema,
} from "@/server/services/contacts.service";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("contacts:read");
    const { id } = await params;
    return ok(await getContactById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("contacts:write");
    const { id } = await params;
    const body = updateContactSchema.parse(await request.json());
    const contact = await updateContact(id, body, session.user.id);

    await writeAuditLog({
      action: "CONTACT_UPDATE",
      entityType: "Contact",
      entityId: contact.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(contact);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("contacts:delete");
    const { id } = await params;
    const contact = await deleteContact(id, session.user.id);

    await writeAuditLog({
      action: "CONTACT_DELETE",
      entityType: "Contact",
      entityId: contact.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: contact.name },
    });

    return ok(contact);
  } catch (error) {
    return fail(error);
  }
}
