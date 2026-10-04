import { getZohoRateLimitPerMin } from "@/server/integrations/zoho/config";

/**
 * Simple in-process sliding-window rate limiter for Zoho Books
 * (~100 req/min org limit; default 90).
 */
const timestamps: number[] = [];

export async function acquireZohoRateSlot() {
  const limit = getZohoRateLimitPerMin();
  const windowMs = 60_000;

  for (;;) {
    const now = Date.now();
    while (timestamps.length && now - timestamps[0]! >= windowMs) {
      timestamps.shift();
    }
    if (timestamps.length < limit) {
      timestamps.push(now);
      return;
    }
    const waitMs = windowMs - (now - timestamps[0]!) + 5;
    await sleep(Math.max(waitMs, 50));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Test helper */
export function __resetZohoRateLimiter() {
  timestamps.length = 0;
}
