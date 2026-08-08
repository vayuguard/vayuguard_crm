import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  deleteTicket,
  getTicketById,
  updateTicket,
} from "@/server/services/tickets.service";
import { updateTicketSchema } from "@/lib/validators/ticket";
import { getClientIp } from "@/server/api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("tickets:read");
    const { id } = await params;
    return ok(await getTicketById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tickets:write");
    const { id } = await params;
    const body = updateTicketSchema.parse(await request.json());
    const ticket = await updateTicket(id, body, session.user.id);

    await writeAuditLog({
      action: "TICKET_UPDATE",
      entityType: "SupportTicket",
      entityId: ticket.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: body,
    });

    return ok(ticket);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("tickets:write");
    const { id } = await params;
    const ticket = await deleteTicket(id, session.user.id);

    await writeAuditLog({
      action: "TICKET_DELETE",
      entityType: "SupportTicket",
      entityId: ticket.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { ticketNumber: ticket.ticketNumber },
    });

    return ok(ticket);
  } catch (error) {
    return fail(error);
  }
}
