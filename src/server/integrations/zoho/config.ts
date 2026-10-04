/**
 * Zoho Books integration config.
 * Secrets come only from environment variables — never hardcode.
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

/** Env-only sync flag (sync). Prefer `isZohoSyncEnabled` from sync-enabled.ts at runtime. */
export function isZohoSyncEnabledEnv() {
  return (process.env.ZOHO_SYNC_ENABLED ?? "false").toLowerCase() === "true";
}

export function getZohoRateLimitPerMin() {
  const n = Number(process.env.ZOHO_RATE_LIMIT_PER_MIN ?? "90");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
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
    rateLimitPerMin: getZohoRateLimitPerMin(),
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
