import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import {
  globalSearch,
  searchQuerySchema,
} from "@/server/services/search.service";
import { searchParamsObject } from "@/lib/validators/common";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const query = searchQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const result = await globalSearch(query);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
