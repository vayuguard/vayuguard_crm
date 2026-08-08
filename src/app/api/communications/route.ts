import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requireSession } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  communicationFiltersSchema,
  createCommunication,
  createCommunicationSchema,
  listCommunications,
} from "@/server/services/communications.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = communicationFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listCommunications(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = createCommunicationSchema.parse(await request.json());
    const communication = await createCommunication(body, session.user.id);

    await writeAuditLog({
      action: "COMMUNICATION_CREATE",
      entityType: "Communication",
      entityId: communication.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { type: communication.type },
    });

    return created(communication);
  } catch (error) {
    return fail(error);
  }
}
