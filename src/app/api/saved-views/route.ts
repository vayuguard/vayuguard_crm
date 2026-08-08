import { NextRequest } from "next/server";
import { ok, created, fail } from "@/server/api/response";
import { getPagination, paginateMeta } from "@/server/api/pagination";
import { requireSession } from "@/server/auth/session";
import {
  createSavedView,
  createSavedViewSchema,
  listSavedViews,
  savedViewFiltersSchema,
} from "@/server/services/saved-views.service";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = request.nextUrl;
    const pagination = getPagination(searchParams);
    const filters = savedViewFiltersSchema.parse(
      searchParamsObject(searchParams),
    );
    const { items, total } = await listSavedViews(
      session.user.id,
      pagination,
      filters,
    );
    return ok(items, paginateMeta(total, pagination.page, pagination.pageSize));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = createSavedViewSchema.parse(await request.json());
    const view = await createSavedView(body, session.user.id);
    return created(view);
  } catch (error) {
    return fail(error);
  }
}
