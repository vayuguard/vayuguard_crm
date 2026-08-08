import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { createTicket, listTickets } from "@/server/services/tickets.service";
import {
  createTicketSchema,
  ticketFiltersSchema,
} from "@/lib/validators/ticket";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("tickets:read");
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = ticketFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listTickets(pagination, filters);
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("tickets:write");
    const body = createTicketSchema.parse(await request.json());
    const ticket = await createTicket(body, session.user.id);

    await writeAuditLog({
      action: "TICKET_CREATE",
      entityType: "SupportTicket",
      entityId: ticket.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { ticketNumber: ticket.ticketNumber },
    });

    return created(ticket);
  } catch (error) {
    return fail(error);
  }
}
