import { NextRequest } from "next/server";
import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import {
  deleteSavedView,
  getSavedViewById,
  updateSavedView,
  updateSavedViewSchema,
} from "@/server/services/saved-views.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    return ok(await getSavedViewById(id, session.user.id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = updateSavedViewSchema.parse(await request.json());
    return ok(await updateSavedView(id, body, session.user.id));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    return ok(await deleteSavedView(id, session.user.id));
  } catch (error) {
    return fail(error);
  }
}
