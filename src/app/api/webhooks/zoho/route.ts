import { NextRequest, NextResponse } from "next/server";
import { getZohoConfig } from "@/server/integrations/zoho/config";
import { enqueueZohoJob } from "@/server/integrations/zoho/queue";

/**
 * Zoho Books webhook receiver.
 * Configure in Zoho: Settings → Automation → Workflow Rules / Webhooks
 * Header: X-Zoho-Webhook-Secret: <ZOHO_WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  const cfg = getZohoConfig();
  const provided =
    request.headers.get("x-zoho-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    "";

  if (!cfg.webhookSecret || provided !== cfg.webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Reply 200 quickly; worker processes the queue.
  await enqueueZohoJob("process_webhook", { body });

  return NextResponse.json({ ok: true }, { status: 200 });
}
