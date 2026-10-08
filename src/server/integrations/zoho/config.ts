/**
 * Zoho Books integration config.
 * Secrets come only from environment variables — never hardcode.
 *
 * Direction: inbound-only (Zoho → CRM). CRM never writes to Zoho.
 */

export type ZohoDc = "in" | "com" | "eu" | "com.au" | "jp" | "ca" | "sa";

const VALID_DCS = new Set<string>([
  "in",
  "com",
  "eu",
  "com.au",
  "jp",
  "ca",
  "sa",
]);

export function getZohoDc(): ZohoDc {
  const raw = (process.env.ZOHO_DC ?? "in").trim().toLowerCase();
  if (!VALID_DCS.has(raw)) return "in";
  return raw as ZohoDc;
}

export function getZohoAccountsBaseUrl(dc = getZohoDc()) {
  return `https://accounts.zoho.${dc}`;
}

export function getZohoBooksBaseUrl(dc = getZohoDc()) {
  return `https://www.zohoapis.${dc}/books/v3`;
}

/** Env-only pull flag. Prefer `isZohoSyncEnabled` from sync-enabled.ts at runtime. */
export function isZohoSyncEnabledEnv() {
  return (process.env.ZOHO_SYNC_ENABLED ?? "false").toLowerCase() === "true";
}

/**
 * Hard kill-switch for CRM → Zoho writes. Always false unless explicitly
 * re-enabled for emergency/migration tooling. Production default: disabled.
 */
export function isZohoOutboundEnabled() {
  return (process.env.ZOHO_OUTBOUND_ENABLED ?? "false").toLowerCase() === "true";
}

/** Soft client rate limit (Zoho org ~100/min). Default 40 to leave headroom. */
export function getZohoRateLimitPerMin() {
  const n = Number(process.env.ZOHO_RATE_LIMIT_PER_MIN ?? "40");
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 90) : 40;
}

/** Minimum gap between Zoho API calls (ms). */
export function getZohoMinRequestGapMs() {
  const n = Number(process.env.ZOHO_MIN_REQUEST_GAP_MS ?? "300");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 300;
}

/** Max list pages fetched per entity type in one pull run. */
export function getZohoPullMaxPages() {
  const n = Number(process.env.ZOHO_PULL_MAX_PAGES ?? "3");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

/** Extra cooldown after HTTP 429 (ms), on top of Retry-After. */
export function getZohoRateLimitCooldownMs() {
  const n = Number(process.env.ZOHO_RATE_LIMIT_COOLDOWN_MS ?? "60000");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 60_000;
}

export function getZohoConfig() {
  return {
    dc: getZohoDc(),
    clientId: process.env.ZOHO_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.ZOHO_CLIENT_SECRET?.trim() ?? "",
    refreshToken: process.env.ZOHO_REFRESH_TOKEN?.trim() ?? "",
    organizationId: process.env.ZOHO_ORGANIZATION_ID?.trim() ?? "",
    webhookSecret: process.env.ZOHO_WEBHOOK_SECRET?.trim() ?? "",
    syncEnabledEnv: isZohoSyncEnabledEnv(),
    outboundEnabled: isZohoOutboundEnabled(),
    rateLimitPerMin: getZohoRateLimitPerMin(),
    minRequestGapMs: getZohoMinRequestGapMs(),
    pullMaxPages: getZohoPullMaxPages(),
    rateLimitCooldownMs: getZohoRateLimitCooldownMs(),
    accountsBaseUrl: getZohoAccountsBaseUrl(),
    booksBaseUrl: getZohoBooksBaseUrl(),
  };
}

export function assertZohoCredentialsConfigured() {
  const cfg = getZohoConfig();
  const missing: string[] = [];
  if (!cfg.clientId) missing.push("ZOHO_CLIENT_ID");
  if (!cfg.clientSecret) missing.push("ZOHO_CLIENT_SECRET");
  if (!cfg.refreshToken) missing.push("ZOHO_REFRESH_TOKEN");
  if (!cfg.organizationId) missing.push("ZOHO_ORGANIZATION_ID");
  if (missing.length) {
    throw new Error(
      `Zoho credentials incomplete. Fill: ${missing.join(", ")}`,
    );
  }
  return cfg;
}
