import { prisma } from "@/server/db/client";
import {
  assertZohoCredentialsConfigured,
  getZohoAccountsBaseUrl,
} from "@/server/integrations/zoho/config";
import { ZohoAuthError } from "@/server/integrations/zoho/errors";

const REFRESH_SKEW_MS = 5 * 60 * 1000;
let refreshInFlight: Promise<string> | null = null;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/**
 * Returns a valid Zoho access token, refreshing ~5 minutes before expiry.
 * Concurrent callers share a single in-flight refresh.
 */
export async function getAccessToken(): Promise<string> {
  const cached = await prisma.zohoTokenCache.findUnique({
    where: { id: "zoho-token" },
  });

  if (
    cached &&
    cached.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS
  ) {
    return cached.accessToken;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshAccessToken(): Promise<string> {
  const cfg = assertZohoCredentialsConfigured();
  const url = new URL(`${getZohoAccountsBaseUrl(cfg.dc)}/oauth/v2/token`);
  url.searchParams.set("refresh_token", cfg.refreshToken);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("client_secret", cfg.clientSecret);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url.toString(), { method: "POST" });
  const json = (await res.json()) as TokenResponse;

  if (!res.ok || !json.access_token) {
    const message =
      json.error_description ||
      json.error ||
      `Zoho token refresh failed (${res.status})`;
    console.error("[zoho] refresh token invalid or revoked:", message);
    throw new ZohoAuthError(message, {
      status: res.status,
      error: json.error,
    });
  }

  const expiresInSec = Number(json.expires_in ?? 3600);
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  await prisma.zohoTokenCache.upsert({
    where: { id: "zoho-token" },
    create: {
      id: "zoho-token",
      accessToken: json.access_token,
      expiresAt,
    },
    update: {
      accessToken: json.access_token,
      expiresAt,
    },
  });

  return json.access_token;
}

/** Exchange a short-lived self-client grant code for a refresh token. */
export async function exchangeGrantCode(grantCode: string) {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET first");
  }

  const url = new URL(`${getZohoAccountsBaseUrl()}/oauth/v2/token`);
  url.searchParams.set("code", grantCode.trim());
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString(), { method: "POST" });
  const json = (await res.json()) as TokenResponse & {
    refresh_token?: string;
    api_domain?: string;
  };

  if (!res.ok || !json.refresh_token) {
    throw new ZohoAuthError(
      json.error_description ||
        json.error ||
        `Grant exchange failed (${res.status})`,
      json,
    );
  }

  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    apiDomain: json.api_domain,
  };
}

export async function clearCachedAccessToken() {
  await prisma.zohoTokenCache.deleteMany({ where: { id: "zoho-token" } });
}
