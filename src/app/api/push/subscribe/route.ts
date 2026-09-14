import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, created, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import {
  removeWebPushSubscription,
  saveWebPushSubscription,
} from "@/server/services/push.service";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = subscribeSchema.parse(await request.json());
    const saved = await saveWebPushSubscription({
      userId: session.user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: request.headers.get("user-agent"),
    });
    return created({ id: saved.id, endpoint: saved.endpoint });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = z
      .object({ endpoint: z.string().url() })
      .parse(await request.json());
    await removeWebPushSubscription(session.user.id, body.endpoint);
    return ok({ removed: true });
  } catch (error) {
    return fail(error);
  }
}
