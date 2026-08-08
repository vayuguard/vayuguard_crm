import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  contactFiltersSchema,
  createContact,
  createContactSchema,
  listContacts,
} from "@/server/services/contacts.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("contacts:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = contactFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listContacts(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("contacts:write");
    const body = createContactSchema.parse(await request.json());
    const contact = await createContact(body, session.user.id);

    await writeAuditLog({
      action: "CONTACT_CREATE",
      entityType: "Contact",
      entityId: contact.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: contact.name, customerId: contact.customerId },
    });

    return created(contact);
  } catch (error) {
    return fail(error);
  }
}
