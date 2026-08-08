import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createCustomField,
  createCustomFieldSchema,
  listCustomFields,
} from "@/server/services/settings.service";
import { getClientIp } from "@/server/api/rate-limit";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("settings:read");
    const moduleName = request.nextUrl.searchParams.get("module") ?? undefined;
    return ok(await listCustomFields(moduleName || undefined));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("settings:write");
    const body = createCustomFieldSchema.parse(await request.json());
    const field = await createCustomField(body);

    await writeAuditLog({
      action: "CUSTOM_FIELD_CREATE",
      entityType: "CustomFieldDefinition",
      entityId: field.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { module: field.module, fieldKey: field.fieldKey },
    });

    return created(field);
  } catch (error) {
    return fail(error);
  }
}
