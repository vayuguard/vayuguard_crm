import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { teamRecordScope } from "@/server/auth/team-scope";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  createTicketMessage,
  listTicketMessages,
} from "@/server/services/tickets.service";
import { createTicketMessageSchema } from "@/lib/validators/ticket";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tickets:read");
    const { id } = await params;
    const pagination = getPagination(request.nextUrl.searchParams);
    const { items, total } = await listTicketMessages(
      id,
      pagination,
      (await teamRecordScope(session)),
    );
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tickets:write");
    const { id } = await params;
    const body = createTicketMessageSchema.parse(await request.json());
    const message = await createTicketMessage(
      id,
      body,
      session.user.id,
      (await teamRecordScope(session)),
    );

    await writeAuditLog({
      action: "TICKET_MESSAGE_CREATE",
      entityType: "TicketMessage",
      entityId: message.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { ticketId: id },
    });

    return created(message);
  } catch (error) {
    return fail(error);
  }
}
