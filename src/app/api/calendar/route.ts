import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  calendarQuerySchema,
  createCalendarEvent,
  createCalendarEventSchema,
  getCalendarFeed,
} from "@/server/services/calendar.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("tasks:read");
    const query = calendarQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const feed = await getCalendarFeed(query);
    return ok(feed);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("tasks:write");
    const body = createCalendarEventSchema.parse(await request.json());
    const result = await createCalendarEvent(body, session.user.id);

    await writeAuditLog({
      action: "CALENDAR_EVENT_CREATE",
      entityType: "CalendarEvent",
      entityId: result.event?.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        title: body.title,
        syncToGoogle: body.syncToGoogle,
        sync: result.sync,
      },
    });

    return created(result);
  } catch (error) {
    return fail(error);
  }
}
