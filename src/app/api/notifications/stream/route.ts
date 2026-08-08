import { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { listNotificationsSince } from "@/server/services/notifications.service";
import { fail } from "@/server/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    let lastSeen = new Date(0);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        send("connected", { userId, at: new Date().toISOString() });

        const poll = async () => {
          if (request.signal.aborted) return;
          try {
            const items = await listNotificationsSince(userId, lastSeen, 25);
            if (items.length) {
              lastSeen = items[items.length - 1]!.createdAt;
              send("notifications", items);
            } else {
              send("ping", { at: new Date().toISOString() });
            }
          } catch (error) {
            send("error", {
              message:
                error instanceof Error ? error.message : "stream poll failed",
            });
          }
        };

        await poll();
        const interval = setInterval(() => {
          void poll();
        }, 5000);

        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
      cancel() {
        /* client disconnected */
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
