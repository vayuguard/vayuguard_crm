import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetZohoRateLimiter,
  getZohoCooldownRemainingMs,
  tripZohoRateLimitCooldown,
} from "@/server/integrations/zoho/rate-limit";
import { isZohoOutboundEnabled } from "@/server/integrations/zoho/config";

describe("zoho inbound-only guards", () => {
  it("keeps outbound disabled by default", () => {
    delete process.env.ZOHO_OUTBOUND_ENABLED;
    expect(isZohoOutboundEnabled()).toBe(false);
  });

  it("only enables outbound when env is true", () => {
    process.env.ZOHO_OUTBOUND_ENABLED = "true";
    expect(isZohoOutboundEnabled()).toBe(true);
    process.env.ZOHO_OUTBOUND_ENABLED = "false";
    expect(isZohoOutboundEnabled()).toBe(false);
  });
});

describe("zoho rate-limit cooldown", () => {
  beforeEach(() => {
    __resetZohoRateLimiter();
    process.env.ZOHO_RATE_LIMIT_COOLDOWN_MS = "5000";
  });

  it("trips cooldown after 429", () => {
    tripZohoRateLimitCooldown(1);
    expect(getZohoCooldownRemainingMs()).toBeGreaterThan(900);
  });
});
