import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requireSession } from "@/server/auth/session";
import {
  listNotifications,
  markNotificationsRead,
  markNotificationsSchema,
  notificationFiltersSchema,
} from "@/server/services/notifications.service";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = notificationFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total, unreadCount } = await listNotifications(
      session.user.id,
      pagination,
      filters,
    );
    return ok(
      { items, unreadCount },
      paginateMeta(total, pagination.page, pagination.pageSize),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = markNotificationsSchema.parse(await request.json());
    const result = await markNotificationsRead(session.user.id, body);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
