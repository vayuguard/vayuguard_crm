import { ok, fail } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import {
  getVapidPublicKey,
  isWebPushConfigured,
} from "@/server/services/push.service";

export async function GET() {
  try {
    await requireSession();
    return ok({
      publicKey: getVapidPublicKey(),
      configured: isWebPushConfigured(),
    });
  } catch (error) {
    return fail(error);
  }
}
