import {
  getZohoMinRequestGapMs,
  getZohoRateLimitCooldownMs,
  getZohoRateLimitPerMin,
} from "@/server/integrations/zoho/config";

/**
 * In-process Zoho rate limiter:
 * - sliding window under ZOHO_RATE_LIMIT_PER_MIN (default 40)
 * - minimum gap between calls
 * - global cooldown after HTTP 429 (blocks all callers until expired)
 */
const timestamps: number[] = [];
let cooldownUntil = 0;
let lastRequestAt = 0;

export async function acquireZohoRateSlot() {
  const limit = getZohoRateLimitPerMin();
  const windowMs = 60_000;
  const minGap = getZohoMinRequestGapMs();

  for (;;) {
    const now = Date.now();

    if (now < cooldownUntil) {
      await sleep(cooldownUntil - now + 25);
      continue;
    }

    if (lastRequestAt > 0 && now - lastRequestAt < minGap) {
      await sleep(minGap - (now - lastRequestAt));
      continue;
    }

    while (timestamps.length && now - timestamps[0]! >= windowMs) {
      timestamps.shift();
    }

    if (timestamps.length < limit) {
      const stamped = Date.now();
      timestamps.push(stamped);
      lastRequestAt = stamped;
      return;
    }

    const waitMs = windowMs - (now - timestamps[0]!) + 5;
    await sleep(Math.max(waitMs, 50));
  }
}

/**
 * Call when Zoho returns 429. Blocks subsequent acquireZohoRateSlot until
 * Retry-After (or default cooldown) elapses.
 */
export function tripZohoRateLimitCooldown(retryAfterSec?: number) {
  const extra = getZohoRateLimitCooldownMs();
  const fromHeader =
    retryAfterSec && retryAfterSec > 0 ? retryAfterSec * 1000 : 0;
  const wait = Math.max(fromHeader, extra, 15_000);
  cooldownUntil = Math.max(cooldownUntil, Date.now() + wait);
  console.warn(
    `[zoho] rate-limit cooldown ${wait}ms (until ${new Date(cooldownUntil).toISOString()})`,
  );
}

export function getZohoCooldownRemainingMs() {
  return Math.max(0, cooldownUntil - Date.now());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Test helper */
export function __resetZohoRateLimiter() {
  timestamps.length = 0;
  cooldownUntil = 0;
  lastRequestAt = 0;
}
